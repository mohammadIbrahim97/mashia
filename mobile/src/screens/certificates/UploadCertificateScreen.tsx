import React, { useCallback, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { AppBar, Button, Icon, Overline } from '@components/index';
import { ProfileStackParamList } from '@navigation/types';
import { errorMessage } from '@services/api';
import {
  CertificateType,
  certificatesService,
} from '@services/certificates.service';
import { uploadsService } from '@services/uploads.service';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<ProfileStackParamList, 'UploadCertificate'>;

const TYPES: { value: CertificateType; label: string }[] = [
  { value: 'health', label: 'Health' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'origin', label: 'Origin' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type LocalImage = { uri: string; type: string; fileName: string };

export function UploadCertificateScreen({ navigation, route }: Props) {
  const { listingId } = route.params;

  const [certType, setCertType] = useState<CertificateType>('health');
  const [authority, setAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [image, setImage] = useState<LocalImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = useCallback(async (source: 'library' | 'camera') => {
    const opts = { mediaType: 'photo' as const, quality: 0.8 as const };
    const result =
      source === 'camera'
        ? await launchCamera(opts)
        : await launchImageLibrary(opts);
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setImage({
      uri: asset.uri,
      type: asset.type ?? 'image/jpeg',
      fileName: asset.fileName ?? `cert_${Date.now()}.jpg`,
    });
  }, []);

  const onSubmit = useCallback(async () => {
    if (!authority.trim()) {
      setError('Issuing authority is required.');
      return;
    }
    if (!DATE_RE.test(issueDate) || !DATE_RE.test(expiryDate)) {
      setError('Dates must be in YYYY-MM-DD format.');
      return;
    }
    if (new Date(expiryDate) < new Date(issueDate)) {
      setError('Expiry date must be on or after issue date.');
      return;
    }
    if (!image) {
      setError('Please attach a photo of the certificate.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const { uploadUrl, fileUrl } = await uploadsService.getPresignedUrl(
        'certificate',
        image.type,
        image.fileName,
      );
      await uploadsService.uploadToS3(uploadUrl, image.uri, image.type);
      const cert = await certificatesService.create({
        type: certType,
        issuingAuthority: authority.trim(),
        issueDate,
        expiryDate,
        fileUrl,
        listingId,
      });
      navigation.replace('CertificateDetail', { certificateId: cert.id });
    } catch (err) {
      setError(errorMessage(err, 'Could not upload certificate.'));
    } finally {
      setBusy(false);
    }
  }, [authority, certType, issueDate, expiryDate, image, listingId, navigation]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="Upload Certificate"
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Overline>TYPE</Overline>
            <View style={styles.chipRow}>
              {TYPES.map((t) => {
                const active = certType === t.value;
                return (
                  <Pressable
                    key={t.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCertType(t.value)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Overline>ISSUING AUTHORITY</Overline>
            <TextInput
              style={styles.input}
              placeholder="e.g. Saudi Veterinary Authority"
              placeholderTextColor={colors.muted}
              value={authority}
              onChangeText={setAuthority}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Overline>ISSUE DATE</Overline>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                value={issueDate}
                onChangeText={setIssueDate}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Overline>EXPIRY DATE</Overline>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                value={expiryDate}
                onChangeText={setExpiryDate}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Overline>CERTIFICATE PHOTO</Overline>
            {image ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: image.uri }} style={styles.preview} />
                <Pressable
                  style={styles.previewRemove}
                  onPress={() => setImage(null)}
                >
                  <Icon name="close" size={14} color={colors.paper} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.pickerRow}>
                <Pressable
                  style={styles.pickBtn}
                  onPress={() => pickImage('library')}
                >
                  <Icon name="image" size={16} color={colors.mashia[600]} />
                  <Text style={styles.pickBtnLabel}>Gallery</Text>
                </Pressable>
                <Pressable
                  style={styles.pickBtn}
                  onPress={() => pickImage('camera')}
                >
                  <Icon name="camera" size={16} color={colors.mashia[600]} />
                  <Text style={styles.pickBtnLabel}>Camera</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={styles.help}>
            Certificates are reviewed by Mashia before they appear as verified to
            buyers.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            kind="primary"
            icon="check"
            full
            loading={busy}
            onPress={onSubmit}
          >
            Submit certificate
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[6] },
  section: { gap: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[3] },

  input: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: colors.paper,
    marginTop: spacing[2],
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
  },
  chipActive: {
    backgroundColor: colors.mashia[600],
    borderColor: colors.mashia[600],
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  chipTextActive: { color: colors.paper },

  pickerRow: { flexDirection: 'row', gap: spacing[2] },
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
  pickBtnLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.mashia[700],
  },

  previewWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  preview: {
    width: 160,
    height: 160,
    borderRadius: radii.md,
    backgroundColor: colors.parchment,
  },
  previewRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  help: {
    ...type.caption,
    color: colors.muted,
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
