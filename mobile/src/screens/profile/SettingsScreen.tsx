import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar, Button, Icon, Overline } from '@components/index';
import { ProfileStackParamList } from '@navigation/ProfileStack';
import { api, errorMessage } from '@services/api';
import { authService } from '@services/auth.service';
import { PreferredLanguage } from '@services/auth.service';
import { useAuth } from '@hooks/useAuth';
import { colors, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

type LangOption = { code: PreferredLanguage; label: string; native: string };

const LANGUAGES: LangOption[] = [
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'tr', label: 'Turkish', native: 'Türkçe' },
];

export function SettingsScreen({ navigation }: Props) {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);

  const [savingLang, setSavingLang] = useState<PreferredLanguage | null>(null);
  const [langError, setLangError] = useState<string | null>(null);

  const onSelectLanguage = async (lang: PreferredLanguage) => {
    if (lang === user?.preferredLanguage || savingLang) return;
    setLangError(null);
    setSavingLang(lang);
    try {
      await api.patch('/users/me', { preferredLanguage: lang });
      const updated = await authService.fetchMe();
      setUser(updated);
    } catch (err) {
      setLangError(errorMessage(err, 'Could not update language. Try again.'));
    } finally {
      setSavingLang(null);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="Settings"
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="arrowLeft" size={22} />
          </Pressable>
        }
      />

      <View style={styles.body}>
        <Overline style={styles.sectionLabel}>LANGUAGE</Overline>

        <View style={styles.card}>
          {LANGUAGES.map((lang, index) => {
            const selected = user?.preferredLanguage === lang.code;
            const loading = savingLang === lang.code;
            return (
              <React.Fragment key={lang.code}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.langRow,
                    pressed && styles.langRowPressed,
                  ]}
                  onPress={() => onSelectLanguage(lang.code)}
                  disabled={!!savingLang}
                >
                  <View style={styles.langText}>
                    <Text style={styles.langLabel}>{lang.label}</Text>
                    <Text style={styles.langNative}>{lang.native}</Text>
                  </View>
                  {loading ? null : selected ? (
                    <Icon name="check" size={18} color={colors.mashia[600]} />
                  ) : null}
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>

        {langError ? <Text style={styles.error}>{langError}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Button kind="secondary" full onPress={signOut} icon="logOut" iconPosition="leading">
          Sign Out
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1, padding: spacing[5] },
  sectionLabel: { marginBottom: spacing[2] },
  card: {
    backgroundColor: colors.parchment,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  langRowPressed: { backgroundColor: colors.hairline },
  langText: { flex: 1 },
  langLabel: {
    ...type.bodyMd,
    color: colors.ink,
  },
  langNative: {
    ...type.caption,
    color: colors.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginHorizontal: spacing[4],
  },
  error: {
    ...type.caption,
    color: colors.statusFlagged,
    marginTop: spacing[3],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
