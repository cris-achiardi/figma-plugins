// Figma design tokens based on Figma's official UI guidelines

export const colors = {
  // Primary
  blue: '#18A0FB',
  blueHover: '#0D8DEC',
  bluePressed: '#0C7FD8',

  // Neutral
  white: '#FFFFFF',
  black: '#000000',
  gray100: '#F5F5F5',
  gray200: '#E5E5E5',
  gray300: '#D1D1D1',
  gray400: '#B3B3B3',
  gray500: '#808080',
  gray600: '#666666',
  gray650: '#444444',
  gray700: '#4D4D4D',
  gray800: '#333333',
  gray900: '#1A1A1A',

  // Semantic
  error: '#F24822',
  warning: '#FFA629',
  success: '#0ACF83',

  // Special
  purple: '#7B61FF',
  hotPink: '#FF00FF',

  // Text (Figma CSS Variables) - light mode fallbacks
  textPrimary: 'var(--figma-color-text, #333333)',
  textSecondary: 'var(--figma-color-text-secondary, #666666)',
  textTertiary: 'var(--figma-color-text-tertiary, #808080)',
  textOnPrimary: 'var(--figma-color-text-onbrand, #FFFFFF)',

  // Background (Figma CSS Variables) - light mode fallbacks
  bgPrimary: 'var(--figma-color-bg-secondary, #F5F5F5)',
  bgSecondary: 'var(--figma-color-bg, #FFFFFF)',
  bgTertiary: 'var(--figma-color-bg-tertiary, #FAFAFA)',
  bgHover: 'var(--figma-color-bg-hover, #F0F0F0)',
  bgSelected: 'var(--figma-color-bg-selected, #E3F2FD)',
  bgBrandHover: 'var(--figma-color-bg-brand-hover, #0C8CE9)',

  // Border (Figma CSS Variables) - light mode fallbacks
  border: 'var(--figma-color-border, #E5E5E5)',
  borderStrong: 'var(--figma-color-border-strong, #CCCCCC)',
  borderFocus: 'var(--figma-color-border-selected, #18A0FB)',
} as const;

export const spacing = {
  xxs: '2px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const;

export const typography = {
  fontFamily: {
    default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  },
  fontSize: {
    xs: '10px',
    sm: '11px',
    md: '12px',
    lg: '13px',
    xl: '14px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: '16px',
    normal: '20px',
    relaxed: '24px',
  },
} as const;

export const borderRadius = {
  none: '0px',
  sm: '2px',
  md: '4px',
  lg: '6px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 2px 4px rgba(0, 0, 0, 0.4)',
  lg: '0 4px 8px rgba(0, 0, 0, 0.5)',
  focus: '0 0 0 2px rgba(24, 160, 251, 0.4)',
} as const;

export const transitions = {
  fast: '100ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
} as const;
