import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii, spacing, type } from '@theme/index';
import { Icon } from './Icon';

export type CountryOption = {
  flag: string;
  code: string;
  name: string;
};

export const COUNTRIES: CountryOption[] = [
  { flag: '🇸🇦', code: '+966', name: 'KSA' },
  { flag: '🇦🇪', code: '+971', name: 'UAE' },
  { flag: '🇸🇾', code: '+963', name: 'SY' },
  { flag: '🇧🇭', code: '+973', name: 'BH' },
  { flag: '🇰🇼', code: '+965', name: 'KW' },
];

type Props = {
  country: CountryOption;
  onCountryChange: (c: CountryOption) => void;
  value: string;
  onChangeText: (v: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
};

export function PhoneInput({
  country,
  onCountryChange,
  value,
  onChangeText,
  autoFocus,
  editable = true,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <View style={styles.row}>
        <Pressable
          style={styles.country}
          onPress={() => setOpen((o) => !o)}
          disabled={!editable}
        >
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.code}>{country.code}</Text>
          <Icon name="chevronRight" size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          autoFocus={autoFocus}
          keyboardType="phone-pad"
          placeholder="5•• ••• ••••"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>

      {open ? (
        <View style={styles.list}>
          {COUNTRIES.map((c, i) => (
            <Pressable
              key={c.code}
              onPress={() => {
                onCountryChange(c);
                setOpen(false);
              }}
              style={[
                styles.listItem,
                i === COUNTRIES.length - 1 && styles.listItemLast,
              ]}
            >
              <Text style={styles.flag}>{c.flag}</Text>
              <Text style={styles.listName}>{c.name}</Text>
              <Text style={styles.listCode}>{c.code}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.parchment,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  flag: { fontSize: 20 },
  code: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
  },
  input: {
    flex: 1,
    backgroundColor: colors.paper,
    borderColor: colors.mashia[600],
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    color: colors.ink,
    ...type.bodyMd,
  },
  list: {
    marginTop: spacing[2],
    backgroundColor: colors.paper,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
  },
  listItemLast: { borderBottomWidth: 0 },
  listName: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  listCode: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
});
