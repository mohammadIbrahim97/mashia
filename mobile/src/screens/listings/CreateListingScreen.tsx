import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { launchImageLibrary } from 'react-native-image-picker';
import { AppBar, Button, Icon, Overline } from '@components/index';
import { ProfileStackParamList } from '@navigation/types';
import { errorMessage } from '@services/api';
import { CreateListingPayload, listingsService } from '@services/listings.service';
import { uploadsService } from '@services/uploads.service';
import { colors, fonts, radii, spacing } from '@theme/index';

type Props = NativeStackScreenProps<ProfileStackParamList, 'CreateListing'>;

const BREEDS = ['awassi', 'najdi', 'arabi', 'shami', 'other'] as const;
const CURRENCIES = ['SYP', 'SAR', 'AED', 'USD'] as const;

type LocalImage = { uri: string; type: string; fileName: string };

export function CreateListingScreen({ navigation, route }: Props) {
  const editId = route.params?.editId;
  const isEdit = Boolean(editId);

  const [title, setTitle] = useState('');
  const [breed, setBreed] = useState<string>('awassi');
  const [quantity, setQuantity] = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [pricePerHead, setPricePerHead] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [originCountry, setOriginCountry] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<LocalImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    listingsService
      .getById(editId)
      .then((listing) => {
        setTitle(listing.title);
        setBreed(listing.breed);
        setQuantity(String(listing.quantity));
        setAgeMonths(String(listing.ageMonths));
        setWeightKg(String(listing.weightKg));
        setPricePerHead(String(listing.pricePerHead));
        setCurrency(listing.currency);
        setOriginCountry(listing.originCountry);
        setOriginCity(listing.originCity);
        setDescription(listing.description ?? '');
      })
      .catch(() => Alert.alert('Error', 'Could not load listing for editing.'))
      .finally(() => setLoadingEdit(false));
  }, [editId]);

  const pickImages = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 8,
      quality: 0.85,
    });
    if (result.assets) {
      const picked: LocalImage[] = result.assets.map((a) => ({
        uri: a.uri!,
        type: a.type ?? 'image/jpeg',
        fileName: a.fileName ?? `image_${Date.now()}.jpg`,
      }));
      setImages((prev) => [...prev, ...picked].slice(0, 8));
    }
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (images.length < 2) {
      setError('Please add at least 2 photos.');
      return;
    }
    if (!quantity || !ageMonths || !weightKg || !pricePerHead) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!originCountry.trim() || !originCity.trim()) {
      setError('Origin country and city are required.');
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const uploadedUrls: string[] = [];
      for (const img of images) {
        const { uploadUrl, fileUrl } = await uploadsService.getPresignedUrl(
          'listing_image',
          img.type,
          img.fileName,
        );
        await uploadsService.uploadToS3(uploadUrl, img.uri, img.type);
        uploadedUrls.push(fileUrl);
      }

      const payload: CreateListingPayload = {
        title: title.trim(),
        breed,
        quantity: Number(quantity),
        ageMonths: Number(ageMonths),
        weightKg: Number(weightKg),
        pricePerHead: Number(pricePerHead),
        currency,
        originCountry: originCountry.trim(),
        originCity: originCity.trim(),
        images: uploadedUrls,
        ...(description.trim() ? { description: description.trim() } : {}),
      };

      if (editId) {
        await listingsService.update(editId, payload);
      } else {
        await listingsService.create(payload);
      }

      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err, 'Could not save listing. Please try again.'));
    } finally {
      setBusy(false);
    }
  }, [
    title,
    breed,
    quantity,
    ageMonths,
    weightKg,
    pricePerHead,
    currency,
    originCountry,
    originCity,
    description,
    images,
    editId,
    navigation,
  ]);

  if (loadingEdit) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <AppBar
          left={
            <Pressable onPress={() => navigation.goBack()}>
              <Icon name="chevronLeft" size={22} />
            </Pressable>
          }
          title={isEdit ? 'Edit Listing' : 'New Listing'}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.mashia[600]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
        title={isEdit ? 'Edit Listing' : 'New Listing'}
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
            <Overline>PHOTOS (min. 2)</Overline>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {images.map((img, i) => (
                <View key={i} style={styles.imageThumbnailWrap}>
                  <Image source={{ uri: img.uri }} style={styles.imageThumbnail} />
                  <Pressable style={styles.imageRemove} onPress={() => removeImage(i)}>
                    <Icon name="close" size={12} color={colors.paper} />
                  </Pressable>
                </View>
              ))}
              {images.length < 8 && (
                <Pressable style={styles.addImageBtn} onPress={pickImages}>
                  <Icon name="camera" size={24} color={colors.muted} />
                  <Text style={styles.addImageText}>Add</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Overline>TITLE</Overline>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50 Awassi ewes, ready to ship"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
          </View>

          <View style={styles.section}>
            <Overline>BREED</Overline>
            <View style={styles.chipRow}>
              {BREEDS.map((b) => {
                const active = breed === b;
                return (
                  <Pressable
                    key={b}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setBreed(b)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {b.charAt(0).toUpperCase() + b.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Overline>QUANTITY</Overline>
              <TextInput
                style={styles.input}
                placeholder="e.g. 50"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Overline>AGE (months)</Overline>
              <TextInput
                style={styles.input}
                placeholder="e.g. 18"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={ageMonths}
                onChangeText={setAgeMonths}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Overline>WEIGHT (kg)</Overline>
              <TextInput
                style={styles.input}
                placeholder="e.g. 45"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={weightKg}
                onChangeText={setWeightKg}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Overline>PRICE / HEAD</Overline>
              <TextInput
                style={styles.input}
                placeholder="e.g. 250"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={pricePerHead}
                onChangeText={setPricePerHead}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Overline>CURRENCY</Overline>
            <View style={styles.chipRow}>
              {CURRENCIES.map((c) => {
                const active = currency === c;
                return (
                  <Pressable
                    key={c}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Overline>ORIGIN COUNTRY</Overline>
              <TextInput
                style={styles.input}
                placeholder="e.g. Syria"
                placeholderTextColor={colors.muted}
                value={originCountry}
                onChangeText={setOriginCountry}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Overline>ORIGIN CITY</Overline>
              <TextInput
                style={styles.input}
                placeholder="e.g. Aleppo"
                placeholderTextColor={colors.muted}
                value={originCity}
                onChangeText={setOriginCity}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Overline>DESCRIPTION (optional)</Overline>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the animals, condition, logistics…"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

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
            {isEdit ? 'Save changes' : 'Publish listing'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[6] },

  section: { gap: spacing[2] },

  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },

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
  textArea: {
    height: 100,
    paddingTop: spacing[3],
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.parchment,
  },
  chipActive: {
    backgroundColor: colors.mashia[600],
    borderColor: colors.mashia[600],
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  chipTextActive: { color: colors.paper },

  imageScroll: { marginTop: spacing[2] },
  imageThumbnailWrap: {
    marginRight: spacing[2],
    position: 'relative',
  },
  imageThumbnail: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    backgroundColor: colors.parchment,
  },
  imageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    backgroundColor: colors.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addImageText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },

  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#B23B3B',
  },

  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.paper,
  },
});
