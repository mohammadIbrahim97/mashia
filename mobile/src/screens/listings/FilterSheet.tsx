import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, Overline } from '@components/index';
import { SearchParams } from '@services/listings.service';
import { colors, fonts, radii, spacing, type } from '@theme/index';

const BREEDS = ['awassi', 'najdi', 'arabi', 'shami', 'other'] as const;

type Props = {
  visible: boolean;
  params: SearchParams;
  onApply: (params: SearchParams) => void;
  onClose: () => void;
};

export function FilterSheet({ visible, params, onApply, onClose }: Props) {
  const [breed, setBreed] = useState<string | undefined>(params.breed);
  const [minPrice, setMinPrice] = useState(
    params.minPrice != null ? String(params.minPrice) : '',
  );
  const [maxPrice, setMaxPrice] = useState(
    params.maxPrice != null ? String(params.maxPrice) : '',
  );
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>(
    params.sort ?? 'newest',
  );

  useEffect(() => {
    if (visible) {
      setBreed(params.breed);
      setMinPrice(params.minPrice != null ? String(params.minPrice) : '');
      setMaxPrice(params.maxPrice != null ? String(params.maxPrice) : '');
      setSort(params.sort ?? 'newest');
    }
  }, [visible, params]);

  const onClear = () => {
    setBreed(undefined);
    setMinPrice('');
    setMaxPrice('');
    setSort('newest');
  };

  const onApplyPress = () => {
    const next: SearchParams = {
      sort,
      limit: params.limit,
      ...(breed ? { breed } : {}),
      ...(minPrice ? { minPrice: Number(minPrice) } : {}),
      ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
    };
    onApply(next);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Overline>BREED</Overline>
              <View style={styles.chipRow}>
                {BREEDS.map((b) => {
                  const active = breed === b;
                  return (
                    <Pressable
                      key={b}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setBreed(active ? undefined : b)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {b.charAt(0).toUpperCase() + b.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Overline>PRICE PER HEAD</Overline>
              <View style={styles.priceRow}>
                <View style={styles.priceField}>
                  <Text style={styles.priceLabel}>Min</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    value={minPrice}
                    onChangeText={setMinPrice}
                  />
                </View>
                <View style={styles.priceSep} />
                <View style={styles.priceField}>
                  <Text style={styles.priceLabel}>Max</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Any"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Overline>SORT BY</Overline>
              <View style={styles.chipRow}>
                {(
                  [
                    { label: 'Newest', value: 'newest' },
                    { label: 'Price ↑', value: 'price_asc' },
                    { label: 'Price ↓', value: 'price_desc' },
                  ] as const
                ).map((opt) => {
                  const active = sort === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSort(opt.value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.clearBtn} onPress={onClear}>
              <Text style={styles.clearText}>Clear all</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={onApplyPress}>
              <Text style={styles.applyText}>Apply filters</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },

  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  headerTitle: {
    ...type.bodyMd,
    fontWeight: '700',
    color: colors.ink,
  },

  body: { padding: spacing[5], gap: spacing[5] },

  section: { gap: spacing[3] },

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

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  priceField: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: colors.paper,
  },
  priceLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    padding: 0,
  },
  priceSep: {
    width: 12,
    height: 1,
    backgroundColor: colors.hairline,
  },

  footer: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  clearBtn: {
    flex: 1,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  applyBtn: {
    flex: 2,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.mashia[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.paper,
  },
});
