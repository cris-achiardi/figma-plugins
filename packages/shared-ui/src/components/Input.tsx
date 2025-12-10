import React, { CSSProperties, InputHTMLAttributes } from 'react';
import { theme } from '../styles/theme';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  fullWidth = false,
  disabled = false,
  style,
  ...inputProps
}) => {
  const [isFocused, setIsFocused] = React.useState(false);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    width: fullWidth ? '100%' : 'auto',
  };

  const labelStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.default,
  };

  const inputStyle: CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.default,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.bgPrimary,
    border: `1px solid ${error ? theme.colors.error : isFocused ? theme.colors.borderFocus : theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    outline: 'none',
    transition: `border-color ${theme.transitions.fast}`,
    cursor: disabled ? 'not-allowed' : 'text',
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? '100%' : 'auto',
    ...style,
  };

  const errorStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily.default,
  };

  return (
    <div style={containerStyle}>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        {...inputProps}
        disabled={disabled}
        style={inputStyle}
        onFocus={(e) => {
          setIsFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          inputProps.onBlur?.(e);
        }}
      />
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
};
