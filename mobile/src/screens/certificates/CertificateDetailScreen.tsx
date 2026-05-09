import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar, Chip, ChipKind, Icon } from '@components/index';
import {
  HomeStackParamList,
  ProfileStackParamList,
} from '@navigation/types';
import { errorMessage } from '@services/api';
import {
  Certificate,
  CertificateStatus,
  CertificateType,
  certificatesService,
} from '@services/certificates.service';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'CertificateDetail'>,
  NativeStackScreenProps<ProfileStackParamList, 'CertificateDetail'>
>;

const TYPE_LABEL: Record<CertificateType, string> = {
  vaccination: 'Vaccination',
  health: 'Health',
  origin: 'Origin',
};

function statusChipKind(status: CertificateStatus): ChipKind {
  if (status === 'verified') return 'verified';
  if (status === 'pending') return 'pending';
  return 'flagged';
}

function statusLabel(status: CertificateStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CertificateDetailScreen({ navigation, route }: Props) {
  const { certificateId } = route.params;

  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    certificatesService
      .getById(certificateId)
      .then((c) => {
        if (!cancelled) setCert(c);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load certificate.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [certificateId]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="Certificate"
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.mashia[600]} />
        </View>
      ) : error || !cert ? (
        <View style={styles.center}>
          <Icon name="alertCircle" size={36} color={colors.muted} />
          <Text style={styles.errorText}>{error ?? 'Certificate not found.'}</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={{ uri: cert.fileUrl }}
            style={styles.preview}
            resizeMode="cover"
          />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeLabel}>{TYPE_LABEL[cert.type]}</Text>
              <Text style={styles.authority}>{cert.issuingAuthority}</Text>
            </View>
            <Chip kind={statusChipKind(cert.status)}>
              {statusLabel(cert.status)}
            </Chip>
          </View>

          {cert.status === 'rejected' && cert.rejectionReason ? (
            <View style={styles.banner}>
              <Icon name="alertCircle" size={18} color={colors.statusFlagged} />
              <Text style={styles.bannerText}>{cert.rejectionReason}</Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Issued</Text>
              <Text style={styles.metaValue}>{formatDate(cert.issueDate)}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Expires</Text>
              <Text style={styles.metaValue}>{formatDate(cert.expiryDate)}</Text>
            </View>
          </View>

          {cert.verifiedAt ? (
            <View style={styles.metaRow}>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Verified at</Text>
                <Text style={styles.metaValue}>{formatDate(cert.verifiedAt)}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  errorText: { ...type.body, color: colors.muted, textAlign: 'center' },
  body: { padding: spacing[5], gap: spacing[5] },
  preview: {
    width: '100%',
    height: 280,
    borderRadius: radii.md,
    backgroundColor: colors.parchment,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  typeLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    color: colors.mashia[600],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  authority: {
    ...type.h3,
    color: colors.ink,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[4],
    backgroundColor: '#F9E5E5',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5B5B5',
  },
  bannerText: {
    flex: 1,
    ...type.caption,
    color: '#7C2A2A',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  metaCol: {
    flex: 1,
    backgroundColor: colors.parchment,
    borderRadius: radii.md,
    padding: spacing[3],
    gap: 4,
  },
  metaLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
});
