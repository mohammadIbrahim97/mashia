import { TextStyle } from 'react-native';

export const fonts = {
  display: 'Fraunces-Variable',
  displayItalic: 'Fraunces-Italic-Variable',
  body: 'Manrope-Variable',
  arDisplay: 'ReemKufi-Variable',
  arBody: 'ReemKufi-Variable',
  mono: 'JetBrainsMono-Medium',
} as const;

export const type = {
  hDisplay: {
    fontFamily: fonts.display,
    fontWeight: '400',
    fontSize: 72,
    lineHeight: 72,
    letterSpacing: -1.8,
  } as TextStyle,
  h1: {
    fontFamily: fonts.display,
    fontWeight: '500',
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -0.96,
  } as TextStyle,
  h2: {
    fontFamily: fonts.display,
    fontWeight: '500',
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -0.48,
  } as TextStyle,
  h3: {
    fontFamily: fonts.display,
    fontWeight: '600',
    fontSize: 22,
    lineHeight: 29,
  } as TextStyle,
  bodyL: {
    fontFamily: fonts.body,
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 29,
  } as TextStyle,
  body: {
    fontFamily: fonts.body,
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 25,
  } as TextStyle,
  bodyMd: {
    fontFamily: fonts.body,
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 23,
  } as TextStyle,
  caption: {
    fontFamily: fonts.body,
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 19,
  } as TextStyle,
  mono: {
    fontFamily: fonts.mono,
    fontWeight: '500',
    fontSize: 11,
    letterSpacing: 1.32,
  } as TextStyle,
} as const;
