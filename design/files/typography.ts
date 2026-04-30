/**
 * Mashia Typography Tokens
 * ========================
 * Design philosophy: Arabic is the primary language, so Arabic readability
 * drives every decision. Latin and Turkish fonts are chosen to MATCH the
 * Arabic font's visual weight, x-height, and rhythm — not the other way around.
 *
 * Why these choices:
 *   - IBM Plex Sans Arabic: open, humanist, excellent at small sizes (where
 *     livestock listings live), free, has matching Latin sibling. eBay-style
 *     workhorse: utility over decoration.
 *   - IBM Plex Sans (Latin/Turkish): the Latin sibling. Designed to share
 *     metrics with the Arabic version, so RTL/LTR mixed strings stay aligned.
 *   - Tajawal (display): warmer, more characterful Arabic — used sparingly
 *     for prices, headlines, brand moments. Adds the "MENA souk signage"
 *     personality that pure Plex would lack.
 *
 * Why no serif: industrial/trade aesthetic, mobile-first reading, and serif
 * Arabic fonts at small sizes still struggle on Android.
 */

// ---------------------------------------------------------------------------
// 1. FONT FAMILIES
// ---------------------------------------------------------------------------

export const fontFamily = {
  // Body / UI — used for 95% of text. Same family name across scripts; the
  // OS picks the right script automatically when text contains Arabic.
  sans: {
    arabic: 'IBMPlexSansArabic',
    latin:  'IBMPlexSans',
    // Convenience CSS stack for web (admin):
    css: `'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif`,
  },

  // Display — prices, hero headlines, brand wordmark contexts. Heavier
  // personality, slightly condensed feel.
  display: {
    arabic: 'Tajawal',
    latin:  'Tajawal', // Tajawal supports Latin too; keeps brand voice consistent
    css: `'Tajawal', 'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, sans-serif`,
  },

  // Mono — order numbers, tracking IDs, KYC reference codes. Trust signal:
  // numbers in mono read as "official record".
  mono: {
    css: `'IBM Plex Mono', 'SF Mono', Menlo, Consolas, monospace`,
  },
} as const;

// ---------------------------------------------------------------------------
// 2. WEIGHTS
// IBM Plex Sans Arabic ships these weights — only reference what exists.
// ---------------------------------------------------------------------------

export const fontWeight = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
} as const;

// ---------------------------------------------------------------------------
// 3. SCALE
// Modular-ish but tuned by hand for Arabic at small sizes (Arabic needs ~1px
// more than Latin to read at the same perceived size, so caption/body run
// slightly larger than you'd expect from a pure Latin scale).
// ---------------------------------------------------------------------------

export const fontSize = {
  '2xs': 11, // legal text, timestamps in dense lists
  xs:    13, // captions, metadata
  sm:    14, // secondary body
  base:  16, // body — Arabic readability minimum
  md:    17, // emphasized body
  lg:    19, // sub-headlines, card titles
  xl:    22, // section headers
  '2xl': 26, // page titles (mobile)
  '3xl': 32, // page titles (admin), display prices
  '4xl': 40, // hero
  '5xl': 56, // marketing/onboarding hero
} as const;

// ---------------------------------------------------------------------------
// 4. LINE HEIGHTS
// Arabic glyphs have descenders/diacritics that need MORE leading than Latin.
// All line-heights are tuned for Arabic-first; Latin gets a bit roomier than
// it strictly needs, which is fine.
// ---------------------------------------------------------------------------

export const lineHeight = {
  tight:   1.20, // display, large headlines
  snug:    1.35, // sub-headlines, card titles
  normal:  1.55, // body — Arabic-safe default
  relaxed: 1.70, // long-form, terms & conditions, listing descriptions
} as const;

// ---------------------------------------------------------------------------
// 5. LETTER SPACING
// Arabic does NOT take tracking adjustments well — letters connect. So tracking
// only varies in Latin contexts (uppercase eyebrows, mono numerals).
// ---------------------------------------------------------------------------

export const letterSpacing = {
  tight:   -0.4,  // large display Latin only
  normal:   0,    // default for everything Arabic
  wide:     0.4,  // small uppercase eyebrows (Latin only)
  widest:   1.2,  // tracked-out micro-labels (Latin only, ALL CAPS)
} as const;

// ---------------------------------------------------------------------------
// 6. TEXT ROLES
// Composed presets. Components reference these by name, never raw values.
// ---------------------------------------------------------------------------

export const textStyle = {
  // Display — used sparingly. Brand moments, prices, hero.
  displayHero: {
    family: fontFamily.display.css,
    size: fontSize['5xl'],
    weight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  displayLarge: {
    family: fontFamily.display.css,
    size: fontSize['4xl'],
    weight: fontWeight.bold,
    lineHeight: lineHeight.tight,
  },
  displayMedium: {
    family: fontFamily.display.css,
    size: fontSize['3xl'],
    weight: fontWeight.bold,
    lineHeight: lineHeight.snug,
  },

  // Headlines — section structure
  headlineLarge: {
    family: fontFamily.sans.css,
    size: fontSize['2xl'],
    weight: fontWeight.bold,
    lineHeight: lineHeight.snug,
  },
  headlineMedium: {
    family: fontFamily.sans.css,
    size: fontSize.xl,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
  },
  headlineSmall: {
    family: fontFamily.sans.css,
    size: fontSize.lg,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
  },

  // Body
  bodyLarge: {
    family: fontFamily.sans.css,
    size: fontSize.md,
    weight: fontWeight.regular,
    lineHeight: lineHeight.normal,
  },
  body: {
    family: fontFamily.sans.css,
    size: fontSize.base,
    weight: fontWeight.regular,
    lineHeight: lineHeight.normal,
  },
  bodySmall: {
    family: fontFamily.sans.css,
    size: fontSize.sm,
    weight: fontWeight.regular,
    lineHeight: lineHeight.normal,
  },

  // Labels — UI elements, buttons
  labelLarge: {
    family: fontFamily.sans.css,
    size: fontSize.base,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
  },
  label: {
    family: fontFamily.sans.css,
    size: fontSize.sm,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
  },
  labelSmall: {
    family: fontFamily.sans.css,
    size: fontSize.xs,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
  },

  // Caption — metadata, helper text
  caption: {
    family: fontFamily.sans.css,
    size: fontSize.xs,
    weight: fontWeight.regular,
    lineHeight: lineHeight.normal,
  },
  captionStrong: {
    family: fontFamily.sans.css,
    size: fontSize.xs,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
  },

  // Eyebrow — small all-caps labels above section titles. Latin only; in
  // Arabic, render at sentence-case with same size/weight (no SHOUTING).
  eyebrow: {
    family: fontFamily.sans.css,
    size: fontSize['2xs'],
    weight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase' as const, // strip in Arabic at component level
  },

  // Price — the eBay move: prices have their own typographic treatment.
  // Slightly heavier, slightly tighter, ALWAYS in display font.
  priceLarge: {
    family: fontFamily.display.css,
    size: fontSize['2xl'],
    weight: fontWeight.bold,
    lineHeight: lineHeight.tight,
  },
  price: {
    family: fontFamily.display.css,
    size: fontSize.lg,
    weight: fontWeight.bold,
    lineHeight: lineHeight.tight,
  },
  priceSmall: {
    family: fontFamily.display.css,
    size: fontSize.md,
    weight: fontWeight.bold,
    lineHeight: lineHeight.tight,
  },

  // Mono — order IDs, tracking codes
  mono: {
    family: fontFamily.mono.css,
    size: fontSize.sm,
    weight: fontWeight.medium,
    lineHeight: lineHeight.snug,
  },
} as const;

export type TextStyle = keyof typeof textStyle;
