/**
 * Mashia Color Tokens
 * ===================
 * Aesthetic: eBay's confident commercial energy adapted for MENA livestock trade.
 * - Trust-forward: every transactional state has a dedicated, unmistakable color.
 * - Warm earth base instead of eBay's cool grey, to feel rooted in the trade.
 * - One bold action accent (Mashia Red) carries CTAs across the whole product.
 *
 * Naming convention:
 *   <role>.<variant>     e.g. brand.primary, surface.raised, text.secondary
 *   state.<lifecycle>    e.g. escrow.held, order.shipped, kyc.verified
 *
 * RTL note: colors carry no direction. All directional logic lives in spacing.ts.
 */

// ---------------------------------------------------------------------------
// 1. PRIMITIVE PALETTE
// Raw color values. Never reference these directly in components — use the
// semantic tokens below. This layer exists so we can re-skin the brand without
// touching component code.
// ---------------------------------------------------------------------------

const palette = {
  // Mashia Red — the single action color. Echoes eBay's commercial confidence
  // but shifted warmer/earthier to evoke MENA souk signage and livestock-tag
  // ink. Used for primary CTAs, active tabs, price emphasis.
  red: {
    50:  '#FFF1EE',
    100: '#FFDDD4',
    200: '#FFB8A6',
    300: '#FF8B70',
    400: '#F75D3C',
    500: '#E63911', // brand.primary
    600: '#C42A07',
    700: '#9C2007',
    800: '#741808',
    900: '#4F1106',
  },

  // Date Palm — a deep saffron-gold. Secondary brand accent. Used for trust
  // marks (verified seller, premium listing), highlights, and section banners.
  // Replaces eBay's blue secondary with something rooted in regional palette.
  gold: {
    50:  '#FFF8E6',
    100: '#FFEBB8',
    200: '#FFD874',
    300: '#F5BD3A',
    400: '#D99E1A',
    500: '#B07D08', // brand.secondary
    600: '#8A6005',
    700: '#664604',
    800: '#473003',
    900: '#2D1E02',
  },

  // Olive — green for verified/success/healthy-animal indicators. Muted
  // intentionally so it reads as "agricultural" rather than "tech-success-toast".
  olive: {
    50:  '#F2F6E8',
    100: '#DDE8C2',
    200: '#BCD083',
    300: '#94B14C',
    400: '#6F8E27',
    500: '#4F6A12', // state.success / kyc.verified
    600: '#3C520C',
    700: '#2C3D08',
    800: '#1E2A05',
    900: '#121902',
  },

  // Indigo — informational and "in transit" states. The single cool color in
  // the system, which keeps it semantically distinct from everything else.
  indigo: {
    50:  '#EEF1FA',
    100: '#D2DAF0',
    200: '#A2B1DF',
    300: '#7088CC',
    400: '#4763B5',
    500: '#2A4694', // state.info / order.shipped
    600: '#1F3676',
    700: '#172759',
    800: '#0F1A3D',
    900: '#080F24',
  },

  // Amber — warning, pending, awaiting action. Distinct from gold (which is a
  // brand color) — amber is more orange and reserved for transactional
  // attention states.
  amber: {
    50:  '#FFF6E5',
    100: '#FFE6B0',
    200: '#FFCD66',
    300: '#FFB01A',
    400: '#E89200',
    500: '#B87100', // state.warning / order.pending
    600: '#8E5600',
    700: '#683E00',
    800: '#472A00',
    900: '#2B1900',
  },

  // Crimson — destructive, refunded, rejected. Pulled away from Mashia Red
  // toward true crimson so the user never confuses a CTA with a danger alert.
  crimson: {
    50:  '#FCEBEC',
    100: '#F6C6C9',
    200: '#EC8B91',
    300: '#DD4F58',
    400: '#B92731',
    500: '#921520', // state.danger / order.refunded
    600: '#700F18',
    700: '#510A11',
    800: '#36060B',
    900: '#1D0306',
  },

  // Sand — the warm neutral spine of the UI. Replaces eBay's pure-grey
  // backgrounds. Carries a faint yellow undertone that flatters product photos
  // of animals and feels less sterile than cool grey.
  sand: {
    0:   '#FFFFFF',
    25:  '#FBF8F3', // page background, light mode
    50:  '#F5F0E6',
    100: '#EDE5D4',
    200: '#DCD0B7',
    300: '#BFAF8E',
    400: '#9C8A65',
    500: '#7A6948',
    600: '#5C4F33',
    700: '#403724',
    800: '#2A2418',
    900: '#17130B', // page background, dark mode
    950: '#0C0A05',
  },
} as const;

// ---------------------------------------------------------------------------
// 2. SEMANTIC TOKENS — LIGHT MODE
// What components actually consume. Each token has a job, not a color.
// ---------------------------------------------------------------------------

export const lightColors = {
  // Brand
  brand: {
    primary:        palette.red[500],   // CTAs, active tab, price emphasis
    primaryHover:   palette.red[600],
    primaryPressed: palette.red[700],
    primaryMuted:   palette.red[50],    // tinted backgrounds for primary chips
    onPrimary:      palette.sand[0],

    secondary:      palette.gold[500],  // verified premium, badges
    secondaryHover: palette.gold[600],
    secondaryMuted: palette.gold[50],
    onSecondary:    palette.sand[0],
  },

  // Surfaces — layered, like eBay's card-on-card hierarchy
  surface: {
    page:       palette.sand[25],   // outermost background
    raised:     palette.sand[0],    // cards, sheets sitting on the page
    sunken:     palette.sand[50],   // inset wells, search bars
    overlay:    'rgba(23, 19, 11, 0.55)', // modal scrim
    inverse:    palette.sand[900],
  },

  // Borders
  border: {
    subtle:  palette.sand[100],   // dividers between rows
    default: palette.sand[200],   // input borders, card outlines
    strong:  palette.sand[400],   // focused inputs, emphasized cards
    inverse: palette.sand[700],
  },

  // Text
  text: {
    primary:   palette.sand[900],  // headlines, body
    secondary: palette.sand[600],  // metadata, captions
    tertiary:  palette.sand[400],  // placeholder, disabled labels
    inverse:   palette.sand[0],    // text on dark surfaces
    link:      palette.indigo[500],
    price:     palette.red[600],   // price emphasis (the "eBay red price")
    success:   palette.olive[600],
    danger:    palette.crimson[500],
  },

  // Transactional states — the heart of a marketplace
  // Each state has BG (chip background), FG (chip text), and Strong (border/dot)
  state: {
    // Generic
    success: { bg: palette.olive[50],   fg: palette.olive[700],   strong: palette.olive[500]  },
    info:    { bg: palette.indigo[50],  fg: palette.indigo[700],  strong: palette.indigo[500] },
    warning: { bg: palette.amber[50],   fg: palette.amber[700],   strong: palette.amber[500]  },
    danger:  { bg: palette.crimson[50], fg: palette.crimson[700], strong: palette.crimson[500]},
    neutral: { bg: palette.sand[50],    fg: palette.sand[700],    strong: palette.sand[500]   },
  },

  // Escrow lifecycle (Mashia's signature feature — these MUST be visually distinct)
  escrow: {
    held:     { bg: palette.indigo[50],  fg: palette.indigo[700],  strong: palette.indigo[500] },
    released: { bg: palette.olive[50],   fg: palette.olive[700],   strong: palette.olive[500]  },
    refunded: { bg: palette.crimson[50], fg: palette.crimson[700], strong: palette.crimson[500]},
    disputed: { bg: palette.amber[50],   fg: palette.amber[700],   strong: palette.amber[500]  },
  },

  // KYC / Verification
  kyc: {
    pending:  { bg: palette.amber[50],   fg: palette.amber[700],   strong: palette.amber[500]  },
    verified: { bg: palette.olive[50],   fg: palette.olive[700],   strong: palette.olive[500]  },
    rejected: { bg: palette.crimson[50], fg: palette.crimson[700], strong: palette.crimson[500]},
  },

  // Order lifecycle
  order: {
    placed:    { bg: palette.sand[100],   fg: palette.sand[800],    strong: palette.sand[600]   },
    paid:      { bg: palette.indigo[50],  fg: palette.indigo[700],  strong: palette.indigo[500] },
    shipped:   { bg: palette.indigo[50],  fg: palette.indigo[700],  strong: palette.indigo[500] },
    delivered: { bg: palette.olive[50],   fg: palette.olive[700],   strong: palette.olive[500]  },
    cancelled: { bg: palette.crimson[50], fg: palette.crimson[700], strong: palette.crimson[500]},
  },

  // Animal health (livestock-specific — domain matters)
  health: {
    healthy:    { bg: palette.olive[50],   fg: palette.olive[700],   strong: palette.olive[500]  },
    quarantine: { bg: palette.amber[50],   fg: palette.amber[700],   strong: palette.amber[500]  },
    flagged:    { bg: palette.crimson[50], fg: palette.crimson[700], strong: palette.crimson[500]},
  },

  // Focus ring — single token, used everywhere a keyboard focus is shown
  focus: palette.red[400],
} as const;

// ---------------------------------------------------------------------------
// 3. SEMANTIC TOKENS — DARK MODE
// Same shape as lightColors so swapping is a one-line theme switch.
// Backgrounds shift to deep sand-black; brand colors slightly lifted for AA contrast.
// ---------------------------------------------------------------------------

export const darkColors = {
  brand: {
    primary:        palette.red[400],
    primaryHover:   palette.red[300],
    primaryPressed: palette.red[200],
    primaryMuted:   'rgba(230, 57, 17, 0.16)',
    onPrimary:      palette.sand[950],

    secondary:      palette.gold[300],
    secondaryHover: palette.gold[200],
    secondaryMuted: 'rgba(217, 158, 26, 0.16)',
    onSecondary:    palette.sand[950],
  },

  surface: {
    page:    palette.sand[950],
    raised:  palette.sand[900],
    sunken:  palette.sand[800],
    overlay: 'rgba(0, 0, 0, 0.7)',
    inverse: palette.sand[25],
  },

  border: {
    subtle:  palette.sand[800],
    default: palette.sand[700],
    strong:  palette.sand[500],
    inverse: palette.sand[200],
  },

  text: {
    primary:   palette.sand[25],
    secondary: palette.sand[300],
    tertiary:  palette.sand[500],
    inverse:   palette.sand[900],
    link:      palette.indigo[300],
    price:     palette.red[300],
    success:   palette.olive[300],
    danger:    palette.crimson[300],
  },

  state: {
    success: { bg: 'rgba(79, 106, 18, 0.18)',   fg: palette.olive[200],   strong: palette.olive[400]  },
    info:    { bg: 'rgba(42, 70, 148, 0.22)',   fg: palette.indigo[200],  strong: palette.indigo[400] },
    warning: { bg: 'rgba(184, 113, 0, 0.20)',   fg: palette.amber[200],   strong: palette.amber[400]  },
    danger:  { bg: 'rgba(146, 21, 32, 0.22)',   fg: palette.crimson[200], strong: palette.crimson[400]},
    neutral: { bg: 'rgba(245, 240, 230, 0.06)', fg: palette.sand[200],    strong: palette.sand[400]   },
  },

  escrow: {
    held:     { bg: 'rgba(42, 70, 148, 0.22)',   fg: palette.indigo[200],  strong: palette.indigo[400] },
    released: { bg: 'rgba(79, 106, 18, 0.18)',   fg: palette.olive[200],   strong: palette.olive[400]  },
    refunded: { bg: 'rgba(146, 21, 32, 0.22)',   fg: palette.crimson[200], strong: palette.crimson[400]},
    disputed: { bg: 'rgba(184, 113, 0, 0.20)',   fg: palette.amber[200],   strong: palette.amber[400]  },
  },

  kyc: {
    pending:  { bg: 'rgba(184, 113, 0, 0.20)',   fg: palette.amber[200],   strong: palette.amber[400]  },
    verified: { bg: 'rgba(79, 106, 18, 0.18)',   fg: palette.olive[200],   strong: palette.olive[400]  },
    rejected: { bg: 'rgba(146, 21, 32, 0.22)',   fg: palette.crimson[200], strong: palette.crimson[400]},
  },

  order: {
    placed:    { bg: 'rgba(245, 240, 230, 0.06)', fg: palette.sand[200],    strong: palette.sand[400]   },
    paid:      { bg: 'rgba(42, 70, 148, 0.22)',   fg: palette.indigo[200],  strong: palette.indigo[400] },
    shipped:   { bg: 'rgba(42, 70, 148, 0.22)',   fg: palette.indigo[200],  strong: palette.indigo[400] },
    delivered: { bg: 'rgba(79, 106, 18, 0.18)',   fg: palette.olive[200],   strong: palette.olive[400]  },
    cancelled: { bg: 'rgba(146, 21, 32, 0.22)',   fg: palette.crimson[200], strong: palette.crimson[400]},
  },

  health: {
    healthy:    { bg: 'rgba(79, 106, 18, 0.18)',   fg: palette.olive[200],   strong: palette.olive[400]  },
    quarantine: { bg: 'rgba(184, 113, 0, 0.20)',   fg: palette.amber[200],   strong: palette.amber[400]  },
    flagged:    { bg: 'rgba(146, 21, 32, 0.22)',   fg: palette.crimson[200], strong: palette.crimson[400]},
  },

  focus: palette.red[300],
} as const;

// ---------------------------------------------------------------------------
// 4. EXPORTS
// ---------------------------------------------------------------------------

export type ColorScheme = typeof lightColors;
export const colors = lightColors; // default export for theme provider
export { palette }; // exposed for edge cases (charts, illustrations) that need raw scales
