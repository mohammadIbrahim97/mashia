import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { AppBar, Button, Chip, Icon, Overline } from '@components/index';
import { ProfileStackParamList } from '@navigation/ProfileStack';
import { kycService, KycStatusResponse } from '@services/kyc.service';
import { errorMessage } from '@services/api';
import { useAuth } from '@hooks/useAuth';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<ProfileStackParamList, 'KycUpload'>;

type PickedFile = { uri: string; type: string; name: string };

type PickSource = 'library' | 'camera';

function pickImage(source: PickSource): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const opts = { mediaType: 'photo' as const, quality: 0.8 as const };
    const handler = (response: Parameters<Parameters<typeof launchImageLibrary>[1]>[0]) => {
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
    if (source === 'camera') {
      launchCamera(opts, handler);
    } else {
      launchImageLibrary(opts, handler);
    }
  });
}

type UploadRowProps = {
  label: string;
  required?: boolean;
  file: PickedFile | null;
  onPick: (source: PickSource) => void;
};

function UploadRow({ label, required, file, onPick }: UploadRowProps) {
  return (
    <View style={rowStyles.wrap}>
      <View style={rowStyles.header}>
        <Text style={rowStyles.label}>
          {label}
          {required ? <Text style={rowStyles.required}> *</Text> : null}
        </Text>
        {file ? (
          <Text style={rowStyles.fileName} numberOfLines={1}>
            {file.name}
          </Text>
        ) : null}
      </View>
      <View style={rowStyles.actions}>
        <Pressable
          style={({ pressed }) => [
            rowStyles.pickBtn,
            pressed && rowStyles.pickBtnPressed,
          ]}
          onPress={() => onPick('library')}
        >
          <Icon name="image" size={16} color={colors.mashia[600]} />
          <Text style={rowStyles.pickBtnLabel}>Gallery</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            rowStyles.pickBtn,
            pressed && rowStyles.pickBtnPressed,
          ]}
          onPress={() => onPick('camera')}
        >
          <Icon name="camera" size={16} color={colors.mashia[600]} />
          <Text style={rowStyles.pickBtnLabel}>Camera</Text>
        </Pressable>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  wrap: {
    gap: spacing[2],
  },
  header: { gap: 2 },
  label: {
    ...type.bodyMd,
    color: colors.ink,
  },
  required: { color: colors.statusFlagged },
  fileName: {
    ...type.caption,
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  pickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.mashia[200],
    backgroundColor: colors.mashia[50],
    minHeight: 44,
  },
  pickBtnPressed: { backgroundColor: colors.mashia[100] },
  pickBtnLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.mashia[700],
  },
});

export function KycUploadScreen({ navigation }: Props) {
  const user = useAuth((s) => s.user);

  const [kycStatus, setKycStatus] = useState<KycStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [nationalId, setNationalId] = useState<PickedFile | null>(null);
  const [selfie, setSelfie] = useState<PickedFile | null>(null);
  const [businessLicense, setBusinessLicense] = useState<PickedFile | null>(null);

  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showBizLicense = user?.role === 'seller' || user?.role === 'broker';
  const canSubmit = !!nationalId && !!selfie && !busy;

  useEffect(() => {
    kycService
      .getStatus()
      .then(setKycStatus)
      .catch(() => setKycStatus(null))
      .finally(() => setLoadingStatus(false));
  }, []);

  const pickFor =
    (setter: (f: PickedFile) => void) => async (source: PickSource) => {
      const file = await pickImage(source);
      if (file) setter(file);
    };

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await kycService.submit({
        nationalId: nationalId!,
        selfie: selfie!,
        ...(businessLicense ? { businessLicense } : {}),
      });
      setSubmitted(true);
    } catch (err) {
      setError(errorMessage(err, 'Upload failed. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const effectiveStatus = submitted ? 'pending' : kycStatus?.status;

  const renderBody = () => {
    if (loadingStatus) {
      return <Text style={styles.info}>Loading status…</Text>;
    }

    if (effectiveStatus === 'verified') {
      return (
        <View style={styles.statusCard}>
          <Icon name="checkCircle" size={32} color={colors.statusVerified} />
          <Chip kind="verified" style={styles.statusChip}>
            Verified
          </Chip>
          <Text style={styles.statusMessage}>Your account is verified.</Text>
        </View>
      );
    }

    if (effectiveStatus === 'pending') {
      return (
        <View style={styles.statusCard}>
          <Icon name="clock" size={32} color={colors.statusPending} />
          <Chip kind="pending" style={styles.statusChip}>
            Pending review
          </Chip>
          <Text style={styles.statusMessage}>
            Documents submitted. We will notify you once reviewed.
          </Text>
        </View>
      );
    }

    return (
      <>
        {effectiveStatus === 'rejected' && kycStatus?.rejectionReason ? (
          <View style={styles.rejectedBanner}>
            <Icon name="alertCircle" size={18} color={colors.statusFlagged} />
            <Text style={styles.rejectedText}>
              Rejected: {kycStatus.rejectionReason}
            </Text>
          </View>
        ) : null}

        <Overline style={styles.sectionLabel}>REQUIRED DOCUMENTS</Overline>

        <View style={styles.card}>
          <UploadRow
            label="National ID Photo"
            required
            file={nationalId}
            onPick={pickFor(setNationalId)}
          />
          <View style={styles.divider} />
          <UploadRow
            label="Selfie"
            required
            file={selfie}
            onPick={pickFor(setSelfie)}
          />
          {showBizLicense ? (
            <>
              <View style={styles.divider} />
              <UploadRow
                label="Business License"
                file={businessLicense}
                onPick={pickFor(setBusinessLicense)}
              />
            </>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    );
  };

  const showSubmitButton =
    !loadingStatus &&
    effectiveStatus !== 'verified' &&
    effectiveStatus !== 'pending';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="KYC Verification"
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="arrowLeft" size={22} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.body}>
        {renderBody()}
      </ScrollView>

      {showSubmitButton ? (
        <View style={styles.footer}>
          <Button
            kind="primary"
            full
            loading={busy}
            disabled={!canSubmit}
            onPress={onSubmit}
          >
            Submit documents
          </Button>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing[5], gap: spacing[5] },
  info: {
    ...type.body,
    color: colors.muted,
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: spacing[7],
    gap: spacing[3],
  },
  statusChip: { alignSelf: 'center' },
  statusMessage: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[4],
    backgroundColor: '#F9E5E5',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5B5B5',
  },
  rejectedText: {
    flex: 1,
    ...type.caption,
    color: '#7C2A2A',
    lineHeight: 18,
  },
  sectionLabel: {},
  card: {
    backgroundColor: colors.parchment,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[4],
    gap: spacing[4],
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
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
