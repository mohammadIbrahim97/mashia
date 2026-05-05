import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar, Chip, Icon, Monogram, Overline } from '@components/index';
import { ProfileStackParamList } from '@navigation/ProfileStack';
import { useAuth } from '@hooks/useAuth';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

type KycBadge = { label: string; kind: 'verified' | 'pending' | 'flagged' };

function kycBadge(status: string): KycBadge {
  if (status === 'verified') return { label: 'Verified', kind: 'verified' };
  if (status === 'pending') return { label: 'Pending', kind: 'pending' };
  return { label: 'Rejected', kind: 'flagged' };
}

type RowProps = {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
};

function Row({ icon, label, sublabel, onPress }: RowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <Icon name="chevronRight" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  if (!user) return null;

  const badge = kycBadge(user.kycStatus);
  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  const showListings = user.role === 'seller' || user.role === 'broker';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar title="Account" />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <Monogram size={72} />
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.phone}>{user.phone}</Text>
          <View style={styles.badges}>
            <Chip kind="neutral">{roleLabel}</Chip>
            <Chip kind={badge.kind}>{badge.label}</Chip>
          </View>
        </View>

        <Overline style={styles.sectionLabel}>ACCOUNT</Overline>

        <View style={styles.card}>
          <Row
            icon={<Icon name="pencil" size={18} color={colors.mashia[600]} />}
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <View style={styles.divider} />
          <Row
            icon={<Icon name="shield" size={18} color={colors.mashia[600]} />}
            label="KYC Verification"
            sublabel={badge.label}
            onPress={() => navigation.navigate('KycUpload')}
          />
          {showListings ? (
            <>
              <View style={styles.divider} />
              <Row
                icon={<Icon name="package" size={18} color={colors.mashia[600]} />}
                label="My Listings"
                onPress={() => navigation.navigate('MyListings')}
              />
            </>
          ) : null}
          <View style={styles.divider} />
          <Row
            icon={<Icon name="user" size={18} color={colors.mashia[600]} />}
            label="Settings"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        <View style={styles.signOutWrap}>
          <Pressable
            style={({ pressed }) => [styles.signOutRow, pressed && styles.rowPressed]}
            onPress={signOut}
          >
            <Icon name="logOut" size={18} color={colors.statusFlagged} />
            <Text style={styles.signOutLabel}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing[5] },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing[6],
    gap: spacing[2],
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '500',
    color: colors.ink,
    marginTop: spacing[3],
    letterSpacing: -0.3,
  },
  phone: {
    ...type.body,
    color: colors.muted,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  sectionLabel: {
    marginBottom: spacing[2],
  },
  card: {
    backgroundColor: colors.parchment,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  rowPressed: { backgroundColor: colors.hairline },
  rowIcon: { width: 24, alignItems: 'center' },
  rowBody: { flex: 1 },
  rowLabel: {
    ...type.bodyMd,
    color: colors.ink,
  },
  rowSublabel: {
    ...type.caption,
    color: colors.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginLeft: spacing[4] + 24 + spacing[3],
  },
  signOutWrap: {
    marginTop: spacing[5],
    backgroundColor: colors.parchment,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  signOutLabel: {
    ...type.bodyMd,
    color: colors.statusFlagged,
    fontWeight: '600',
  },
});
