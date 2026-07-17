import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar } from '@components/index';
import { ChatStackParamList } from '@navigation/types';
import { useMessaging } from '@store/messaging.store';
import { ConversationItem } from '@services/messaging.service';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<ChatStackParamList, 'Conversations'>;


function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  if (diffDays < 7) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  }
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ⚡ Bolt Optimization:
// Extracted ConversationListItem and wrapped with React.memo to prevent unnecessary re-renders.
// Used stable onConversationPress callback in parent to maintain referential equality.
// Measured impact: Reduces re-renders of list items during message updates.
const ConversationListItem = React.memo(({ item, onPress }: { item: ConversationItem; onPress: (id: string, title: string) => void }) => (
  <Pressable
    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    onPress={() => onPress(item.id, item.otherParticipant.fullName)}
  >
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>
        {initials(item.otherParticipant.fullName)}
      </Text>
    </View>

    <View style={styles.rowBody}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {item.otherParticipant.fullName}
        </Text>
        {item.lastMessage ? (
          <Text style={styles.time}>
            {formatTime(item.lastMessage.createdAt)}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.preview} numberOfLines={1}>
          {item.lastMessage
            ? item.lastMessage.type === 'image'
              ? 'Photo'
              : item.lastMessage.content
            : 'No messages yet'}
        </Text>
        {item.unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unreadCount}</Text>
          </View>
        ) : null}
      </View>
    </View>
  </Pressable>
));

export function ConversationsScreen({ navigation }: Props) {
  const conversations = useMessaging((s) => s.conversations);
  const convsLoading = useMessaging((s) => s.convsLoading);
  const loadConversations = useMessaging((s) => s.loadConversations);

  React.useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const onRefresh = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  const onConversationPress = useCallback((conversationId: string, title: string) => {
    navigation.navigate('Chat', { conversationId, title });
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: ConversationItem }) => (
      <ConversationListItem
        item={item}
        onPress={onConversationPress}
      />
    ),
    [onConversationPress],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar title="Messages" />

      {convsLoading && conversations.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.mashia[600]} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshing={convsLoading}
          onRefresh={onRefresh}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No conversations yet</Text>
            </View>
          }
          contentContainerStyle={
            conversations.length === 0 ? styles.emptyContainer : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1 },
  empty: {
    ...type.body,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.paper,
  },
  rowPressed: { backgroundColor: colors.parchment },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.mashia[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 15,
    color: colors.mashia[700],
  },
  rowBody: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    ...type.bodyMd,
    color: colors.ink,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing[2],
  },
  time: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    flex: 1,
    marginRight: spacing[2],
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: '#B23B3B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 11,
    color: colors.paper,
  },
  separator: {
    height: 1,
    backgroundColor: colors.hairline,
    marginLeft: spacing[4] + 44 + spacing[3],
  },
});
