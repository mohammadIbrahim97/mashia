import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@theme/index';

const LENGTH = 6;

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  autoFocus?: boolean;
};

/**
 * 6-digit OTP entry. Six display cells driven by a single hidden TextInput
 * so platform OTP autofill (sms-otp on iOS, autofill on Android) still works.
 */
export function OtpInput({ value, onChangeText, autoFocus = true }: Props) {
  const ref = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const onChange = (raw: string) => {
    onChangeText(raw.replace(/\D/g, '').slice(0, LENGTH));
  };

  return (
    <Pressable style={styles.wrap} onPress={() => ref.current?.focus()}>
      <View style={styles.row}>
        {Array.from({ length: LENGTH }, (_, i) => {
          const filled = i < value.length;
          const focused = i === value.length;
          return (
            <View
              key={i}
              style={[
                styles.cell,
                filled && styles.cellFilled,
                focused && styles.cellFocused,
              ]}
            >
              {filled ? <Text style={styles.digit}>{value[i]}</Text> : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LENGTH}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  row: { flexDirection: 'row', gap: spacing[2] },
  cell: {
    flex: 1,
    aspectRatio: 0.9,
    backgroundColor: colors.paper,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: {
    backgroundColor: colors.mashia[50],
    borderColor: colors.mashia[600],
  },
  cellFocused: {
    borderColor: colors.mashia[600],
    borderWidth: 2,
  },
  digit: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '500',
    color: colors.mashia[700],
  },
  hidden: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    color: 'transparent',
    fontSize: 1,
    opacity: 0,
  },
});
