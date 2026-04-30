/**
 * Mashia Spacing, Layout & Surface Tokens
 * =======================================
 * This file is THE place where text direction (LTR vs RTL) is handled.
 *
 * Rule: components must NEVER use `marginLeft` / `marginRight` / `paddingLeft`
 * / `paddingRight` / `left` / `right` directly. Always use the directional
 * helpers (`marginStart`, `marginEnd`, `paddingStart`, `paddingEnd`, `insetStart`,
 * `insetEnd`) so Arabic layouts mirror automatically.
 *
 * On React Native: the platform supports `marginStart`/`marginEnd` natively
 * since RN 0.59. On web (admin), we map start/end to the CSS logical properties
 * (`margin-inline-start`, `padding-inline-start`, etc.) which the browser
 * resolves based on `dir="rtl"`.
 */

// ---------------------------------------------------------------------------
// 1. SPACING SCALE
// 4-pt base grid. Named like a Tailwind/Material scale so the whole team can
// read it at a glance. Numbers are pixels.
// ---------------------------------------------------------------------------

export const spacing = {
  none: 0,
  '3xs': 2,   // hairline gaps inside chips
  '2xs': 4,   // icon-to-text spacing
  xs:    6,
  sm:    8,   // most icon padding, badge inner
  md:    12,  // standard list-row vertical
  lg:    16,  // standard card padding (mobile)
  xl:    20,
  '2xl': 24,  // section spacing inside cards
  '3xl': 32,  // between sections
  '4xl': 40,
  '5xl': 48,  // major page sections
  '6xl': 64,
  '7xl': 80,  // hero sections (admin)
  '8xl': 96,
} as const;

// ---------------------------------------------------------------------------
// 2. RADII
// eBay leans angular (4px). We go a bit warmer (6px / 10px) to match the
// earth-tone palette and Tajawal's softer Arabic curves. Pills for chips
// and badges only.
// ---------------------------------------------------------------------------

export const radius = {
  none: 0,
  xs:   4,    // dense data-table cells, inline tags
  sm:   6,    // inputs, small buttons
  md:   10,   // cards, primary buttons, modals
  lg:   14,   // hero cards, image containers
  xl:   20,   // bottom sheets
  full: 9999, // chips, avatars, status pills
} as const;

// ---------------------------------------------------------------------------
// 3. BORDERS
// Width tokens. Color comes from colors.border.*
// ---------------------------------------------------------------------------

export const borderWidth = {
  none:    0,
  hairline: 0.5, // mobile dividers (Retina-friendly)
  thin:     1,   // default
  medium:   2,   // focus rings, emphasized cards
  thick:    3,   // hover/pressed emphasis on critical CTAs
} as const;

// ---------------------------------------------------------------------------
// 4. SHADOWS
// Warm-tinted shadows (sand[900] base, not black) — black shadows on a sand
// background look like a hole punched through; tinted shadows look like the
// element is sitting ON the surface. Subtle but recognizable.
// ---------------------------------------------------------------------------

export const shadow = {
  // Web (CSS box-shadow strings)
  web: {
    none: 'none',
    xs:   '0 1px 2px rgba(23, 19, 11, 0.04)',
    sm:   '0 2px 4px rgba(23, 19, 11, 0.06), 0 1px 2px rgba(23, 19, 11, 0.04)',
    md:   '0 4px 12px rgba(23, 19, 11, 0.08), 0 2px 4px rgba(23, 19, 11, 0.04)',
    lg:   '0 12px 28px rgba(23, 19, 11, 0.12), 0 4px 8px rgba(23, 19, 11, 0.06)',
    xl:   '0 24px 48px rgba(23, 19, 11, 0.18), 0 8px 16px rgba(23, 19, 11, 0.08)',
    // Inset for sunken inputs
    inset: 'inset 0 1px 2px rgba(23, 19, 11, 0.06)',
    // Focus ring — paired with outline to be high-contrast
    focus: '0 0 0 3px rgba(247, 93, 60, 0.32)',
  },

  // React Native (platform-shaped shadow object)
  native: {
    none: { shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 },
    xs: {
      shadowColor: '#17130B', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
    },
    sm: {
      shadowColor: '#17130B', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    md: {
      shadowColor: '#17130B', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    },
    lg: {
      shadowColor: '#17130B', shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12, shadowRadius: 28, elevation: 8,
    },
    xl: {
      shadowColor: '#17130B', shadowOffset: { width: 0, height: 24 },
      shadowOpacity: 0.18, shadowRadius: 48, elevation: 16,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// 5. LAYOUT
// ---------------------------------------------------------------------------

export const layout = {
  // Mobile breakpoints — for tablet adaptation
  breakpoint: {
    sm: 380, // small phones
    md: 600, // large phones / small tablets
    lg: 900, // tablets landscape
  },

  // Admin breakpoints (Tailwind defaults to keep familiarity)
  adminBreakpoint: {
    sm:  640,
    md:  768,
    lg:  1024,
    xl:  1280,
    '2xl': 1536,
  },

  // Container max-widths (admin)
  container: {
    sm:  640,
    md:  768,
    lg:  1024,
    xl:  1200,
    '2xl': 1440,
  },

  // Hit targets (accessibility minimum)
  hitTarget: {
    minimum:    44, // iOS HIG / Material — never go below this
    comfortable: 48,
    spacious:   56,
  },

  // Z-index stack — explicit, no magic numbers in components
  z: {
    base:     0,
    raised:   10,
    sticky:   100,
    dropdown: 200,
    overlay:  300,
    modal:    400,
    toast:    500,
    tooltip:  600,
  },

  // Common dimensions
  size: {
    iconXs: 12,
    iconSm: 16,
    iconMd: 20,
    iconLg: 24,
    iconXl: 32,
    avatarSm: 28,
    avatarMd: 40,
    avatarLg: 56,
    avatarXl: 80,
  },
} as const;

// ---------------------------------------------------------------------------
// 6. RTL DIRECTIONAL HELPERS
// The most important part of this file. Components import these instead of
// hard-coding `marginLeft` / `marginRight`.
// ---------------------------------------------------------------------------

import { I18nManager, Platform } from 'react-native';

/**
 * Returns true when the device is running in RTL mode.
 * On web (admin), this should be wrapped to read from <html dir>.
 */
export const isRTL = (): boolean => {
  if (Platform.OS === 'web') {
    // On web, this file is also imported by the admin app — fall back to DOM check
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('dir') === 'rtl';
    }
    return false;
  }
  return I18nManager.isRTL;
};

/**
 * Generates start/end-aware spacing styles for React Native.
 * RN 0.59+ supports marginStart/marginEnd natively, so these flow correctly
 * once I18nManager.forceRTL(true) is set. We expose a helper for clarity.
 */
export const directional = {
  marginStart: (v: number) => ({ marginStart: v } as const),
  marginEnd:   (v: number) => ({ marginEnd: v }   as const),
  paddingStart: (v: number) => ({ paddingStart: v } as const),
  paddingEnd:   (v: number) => ({ paddingEnd: v }   as const),
};

// ---------------------------------------------------------------------------
// 7. ICON MIRRORING
// Some icons are direction-aware (chevron-back, arrow-forward, send) and MUST
// flip in RTL. Others (search, heart, cart) are direction-agnostic and must
// NOT flip. This list is the single source of truth — components consult it
// before rendering an icon.
// ---------------------------------------------------------------------------

export const mirrorInRTL = new Set<string>([
  // Directional arrows & chevrons
  'arrow-left', 'arrow-right', 'arrow-back', 'arrow-forward',
  'chevron-left', 'chevron-right', 'chevron-back', 'chevron-forward',
  'caret-left', 'caret-right',

  // Action icons that imply forward motion
  'send', 'reply', 'forward', 'undo', 'redo',
  'log-in', 'log-out',

  // Navigation
  'menu-unfold', 'menu-fold',
  'breadcrumb-separator',

  // Progress / steppers
  'next-step', 'previous-step',
]);

/** Decide if an icon should be mirrored at render time. */
export const shouldMirrorIcon = (iconName: string): boolean =>
  isRTL() && mirrorInRTL.has(iconName);

// ---------------------------------------------------------------------------
// 8. TRANSITION TIMINGS
// Snappy, eBay-feel — no slow consumer-y springs. Trust comes from the UI
// feeling "responsive and serious", not "playful".
// ---------------------------------------------------------------------------

export const motion = {
  duration: {
    instant: 80,
    fast:    140,
    base:    200,
    slow:    320,
    slower:  480,
  },
  easing: {
    standard:    'cubic-bezier(0.2, 0, 0, 1)',
    decelerate:  'cubic-bezier(0, 0, 0, 1)',
    accelerate:  'cubic-bezier(0.3, 0, 1, 1)',
    emphasized:  'cubic-bezier(0.2, 0, 0, 1.2)',
  },
} as const;
