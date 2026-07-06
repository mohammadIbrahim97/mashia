import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { io, Socket } from 'socket.io-client';
import { AppBar, Icon } from '@components/index';
import { ChatStackParamList } from '@navigation/types';
import { useMessaging } from '@store/messaging.store';
import { useAuth } from '@hooks/useAuth';
import { Message } from '@services/messaging.service';
import { uploadsService } from '@services/uploads.service';
import { loadTokens } from '@services/api';
import { config } from '../../config';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type PickedImage = { uri: string; type: string; name: string };
type PickSource = 'library' | 'camera';

function pickImage(source: PickSource): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const opts = { mediaType: 'photo' as const, quality: 0.8 as const };
    const handler = (response: ImagePickerResponse) => {
      const asset = response.assets?.[0];
      if (!asset || !asset.uri) {
        resolve(null);
        return;
      }
      resolve({
        uri: asset.uri,
        type: asset.type ?? 'image/jpeg',
        name: asset.fileName ?? 'photo.jpg',
      });
    };
    if (source === 'camera') launchCamera(opts, handler);
    else launchImageLibrary(opts, handler);
  });
}

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

function formatBubbleTime(isoString: string): string {
  const date = new Date(isoString);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function ChatScreen({ navigation, route }: Props) {
  const { conversationId, title } = route.params;

  const user = useAuth((s) => s.user);
  const messages = useMessaging((s) => s.messages[conversationId] ?? []);
  const messagesLoading = useMessaging((s) => s.messagesLoading);
  const loadMessages = useMessaging((s) => s.loadMessages);
  const appendMessage = useMessaging((s) => s.appendMessage);

  const socketRef = useRef<Socket | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentTypingRef = useRef(false);
  const otherTypingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitTypingStop = useCallback(() => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (sentTypingRef.current && socketRef.current) {
      socketRef.current.emit('typing', { conversationId, isTyping: false });
      sentTypingRef.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    loadMessages(conversationId, true);

    let socket: Socket;

    (async () => {
      const tokens = await loadTokens();
      socket = io(`${config.apiBaseUrl}/chat`, {
        auth: { token: tokens?.accessToken ?? '' },
        transports: ['websocket'],
      });
      socketRef.current = socket;

      socket.emit('joinConversation', { conversationId });

      socket.on('newMessage', (msg: Message) => {
        appendMessage(conversationId, msg);
      });

      socket.on(
        'userTyping',
        ({ isTyping }: { conversationId: string; userId: string; isTyping: boolean }) => {
          setOtherTyping(isTyping);
          if (otherTypingClearRef.current) {
            clearTimeout(otherTypingClearRef.current);
            otherTypingClearRef.current = null;
          }
          if (isTyping) {
            otherTypingClearRef.current = setTimeout(
              () => setOtherTyping(false),
              5000,
            );
          }
        },
      );
    })();

    return () => {
      emitTypingStop();
      if (otherTypingClearRef.current) clearTimeout(otherTypingClearRef.current);
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [conversationId, appendMessage, loadMessages, emitTypingStop]);

  const onChangeBody = useCallback(
    (next: string) => {
      setBody(next);
      if (!socketRef.current) return;
      if (next.length === 0) {
        emitTypingStop();
        return;
      }
      if (!sentTypingRef.current) {
        socketRef.current.emit('typing', { conversationId, isTyping: true });
        sentTypingRef.current = true;
      }
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = setTimeout(emitTypingStop, 3000);
    },
    [conversationId, emitTypingStop],
  );

  const onSend = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed || sending || !socketRef.current) return;

    emitTypingStop();
    setSending(true);
    socketRef.current.emit(
      'sendMessage',
      { conversationId, content: trimmed, type: 'text' },
      (ack: { ok: boolean; message?: Message }) => {
        setSending(false);
        if (ack.ok && ack.message) {
          appendMessage(conversationId, ack.message);
          setBody('');
        }
      },
    );
  }, [body, sending, conversationId, appendMessage, emitTypingStop]);

  const sendImage = useCallback(
    async (source: PickSource) => {
      if (uploadingImage || !socketRef.current) return;

      const file = await pickImage(source);
      if (!file) return;

      setUploadingImage(true);
      try {
        const { uploadUrl, fileUrl } = await uploadsService.getPresignedUrl(
          'chat_image',
          file.type,
          file.name,
        );
        await uploadsService.uploadToS3(uploadUrl, file.uri, file.type);

        socketRef.current.emit(
          'sendMessage',
          { conversationId, content: fileUrl, type: 'image' },
          (ack: { ok: boolean; message?: Message }) => {
            if (ack.ok && ack.message) {
              appendMessage(conversationId, ack.message);
            }
          },
        );
      } catch {
        Alert.alert('Upload failed', 'Could not send image. Try again.');
      } finally {
        setUploadingImage(false);
      }
    },
    [uploadingImage, conversationId, appendMessage],
  );

  const onAttach = useCallback(() => {
    Alert.alert('Send image', undefined, [
      { text: 'Camera', onPress: () => sendImage('camera') },
      { text: 'Gallery', onPress: () => sendImage('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [sendImage]);

  // ⚡ Bolt Performance Optimization: Memoize reversed array
  // Prevent O(N) array clone/reverse and FlatList re-renders on every keystroke
  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      const isOwn = item.senderId === user?.id;
      const isImage = item.type === 'image';
      return (
        <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
          {!isOwn ? (
            <Text style={styles.senderName}>{title}</Text>
          ) : null}
          {isImage ? (
            <Image
              source={{ uri: item.content }}
              style={styles.imageBubble}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
                {item.content}
              </Text>
            </View>
          )}
          <Text style={[styles.bubbleTime, isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeOther]}>
            {formatBubbleTime(item.createdAt)}
          </Text>
        </View>
      );
    },
    [user?.id, title],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title={title}
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
      />

      {messagesLoading && messages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.mashia[600]} />
        </View>
      ) : (
        <FlatList
          data={reversed}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {otherTyping ? (
          <View style={styles.typingRow}>
            <Text style={styles.typingText}>{title} is typing…</Text>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <Pressable
            style={({ pressed }) => [
              styles.attachBtn,
              uploadingImage && styles.attachBtnDisabled,
              pressed && !uploadingImage && styles.attachBtnPressed,
            ]}
            onPress={onAttach}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <ActivityIndicator size="small" color={colors.mashia[600]} />
            ) : (
              <Icon name="image" size={20} color={colors.mashia[600]} />
            )}
          </Pressable>
          <TextInput
            style={styles.input}
            value={body}
            onChangeText={onChangeBody}
            placeholder="Type a message…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              (!body.trim() || sending) && styles.sendBtnDisabled,
              pressed && body.trim() && !sending && styles.sendBtnPressed,
            ]}
            onPress={onSend}
            disabled={!body.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.paper} />
            ) : (
              <Icon name="send" size={18} color={colors.paper} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: spacing[6],
  },
  emptyText: {
    ...type.body,
    color: colors.muted,
  },
  bubbleRow: {
    marginBottom: spacing[3],
    maxWidth: '80%',
  },
  bubbleRowOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleRowOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 2,
  },
  bubble: {
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  bubbleOwn: {
    backgroundColor: colors.mashia[600],
  },
  bubbleOther: {
    backgroundColor: colors.parchment,
  },
  imageBubble: {
    width: 220,
    height: 220,
    borderRadius: radii.md,
    backgroundColor: colors.parchment,
  },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextOwn: {
    color: colors.paper,
  },
  bubbleTextOther: {
    color: colors.ink,
  },
  bubbleTime: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  bubbleTimeOwn: {
    alignSelf: 'flex-end',
  },
  bubbleTimeOther: {
    alignSelf: 'flex-start',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.paper,
    gap: spacing[2],
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.parchment,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    maxHeight: 120,
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.mashia[600],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnPressed: {
    backgroundColor: colors.mashia[700],
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.mashia[50],
    borderWidth: 1,
    borderColor: colors.mashia[200],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  attachBtnDisabled: {
    opacity: 0.5,
  },
  attachBtnPressed: {
    backgroundColor: colors.mashia[100],
  },
  typingRow: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    backgroundColor: colors.paper,
  },
  typingText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.muted,
  },
});
