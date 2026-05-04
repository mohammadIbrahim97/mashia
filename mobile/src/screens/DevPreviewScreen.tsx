import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppBar,
  Button,
  Chip,
  Icon,
  Monogram,
  Overline,
  StepIndicator,
  Wordmark,
} from '@components/index';
import { colors, radii, spacing, type } from '@theme/index';

/**
 * Phase A dev preview — exercises the design tokens and atomic components
 * on a live device so we can verify fonts, colors, and layout before Phase B
 * builds the real auth flow.
 */
export function DevPreviewScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="Design system"
        left={<Icon name="chevronLeft" size={22} />}
        right={
          <Text style={[type.mono, { color: colors.muted }]}>v0.1</Text>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <Monogram size={64} />
          <Wordmark size={56} />
        </View>

        <Section label="01 · TYPOGRAPHY">
          <Text style={[type.hDisplay, styles.fg1]}>
            A green
            <Text
              style={[
                type.hDisplay,
                {
                  fontStyle: 'italic',
                  color: colors.qasiounGold,
                  fontFamily: 'Fraunces-Italic-Variable',
                },
              ]}
            >
              {' '}thread.
            </Text>
          </Text>
          <Text style={[type.h2, styles.fg1, { marginTop: spacing[3] }]}>
            Display heading.
          </Text>
          <Text style={[type.body, styles.fg1, { marginTop: spacing[3] }]}>
            Mashia connects verified sellers, buyers, and brokers across the
            Gulf and Levant. Escrow on every order. Halal certificates baked
            in.
          </Text>
          <Text style={[type.caption, styles.fg2, { marginTop: spacing[3] }]}>
            Caption — secondary text.
          </Text>
        </Section>

        <Section label="02 · COLOR">
          <View style={styles.swatchRow}>
            <Swatch color={colors.mashia[600]} label="Mashia 600" />
            <Swatch color={colors.qasiounGold} label="Gold" />
            <Swatch color={colors.basaltBlack} label="Basalt" />
            <Swatch color={colors.parchment} label="Parchment" />
          </View>
        </Section>

        <Section label="03 · BUTTONS">
          <View style={{ gap: spacing[3] }}>
            <Button kind="primary" icon="arrowRight">
              Place order
            </Button>
            <Button kind="secondary">I already have an account</Button>
            <Button kind="ghost">Recover access</Button>
          </View>
        </Section>

        <Section label="04 · CHIPS">
          <View style={styles.chipRow}>
            <Chip kind="verified">Verified ✓</Chip>
            <Chip kind="pending">Pending</Chip>
            <Chip kind="info">Info</Chip>
            <Chip kind="flagged">Flagged</Chip>
            <Chip kind="neutral">Add</Chip>
          </View>
        </Section>

        <Section label="05 · STEP INDICATOR">
          <StepIndicator total={3} current={2} />
        </Section>

        <Section label="06 · ICONS">
          <View style={styles.iconRow}>
            {(
              [
                'arrowRight',
                'chevronLeft',
                'shield',
                'check',
                'image',
                'message',
                'shoppingBag',
                'user',
              ] as const
            ).map((n) => (
              <View key={n} style={styles.iconCell}>
                <Icon name={n} />
              </View>
            ))}
          </View>
        </Section>

        <Section label="07 · OVERLINE">
          <Overline bullet>● 01 · YOUR NUMBER</Overline>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Overline bullet>{label}</Overline>
      <View style={{ marginTop: spacing[3] }}>{children}</View>
    </View>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.swatchCell}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={[type.caption, { color: colors.muted, marginTop: 6 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  section: {
    marginTop: spacing[6],
  },
  fg1: { color: colors.fg1 },
  fg2: { color: colors.fg2 },
  swatchRow: { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
  swatchCell: { width: 76, alignItems: 'center' },
  swatch: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.parchment,
  },
});
