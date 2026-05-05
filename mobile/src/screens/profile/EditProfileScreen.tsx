import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar, Button, Icon, Overline } from '@components/index';
import { ProfileStackParamList } from '@navigation/types';
import { api, errorMessage } from '@services/api';
import { authService } from '@services/auth.service';
import { useAuth } from '@hooks/useAuth';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = fullName.trim().length > 0 && !busy;

  const onSave = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.patch('/users/me', {
        fullName: fullName.trim(),
        email: email.trim() || null,
        city: city.trim() || null,
      });
      const updated = await authService.fetchMe();
      setUser(updated);
      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err, 'Could not save changes. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="Edit Profile"
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="arrowLeft" size={22} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Overline>FULL NAME</Overline>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Overline>EMAIL (OPTIONAL)</Overline>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Overline>CITY (OPTIONAL)</Overline>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Your city"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={canSave ? onSave : undefined}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          kind="primary"
          full
          loading={busy}
          disabled={!canSave}
          onPress={onSave}
        >
          Save changes
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing[5], gap: spacing[5] },
  field: { gap: spacing[2] },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    backgroundColor: colors.parchment,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    minHeight: 52,
  },
  error: {
    ...type.caption,
    color: colors.statusFlagged,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
