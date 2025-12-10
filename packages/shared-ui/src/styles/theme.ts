import { colors, spacing, typography, borderRadius, shadows, transitions } from './tokens';

export const theme = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
} as const;

export type Theme = typeof theme;
