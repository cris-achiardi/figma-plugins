import React, { CSSProperties, SelectHTMLAttributes } from 'react';
import { theme } from '../styles/theme';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  options: SelectOption[];
  error?: string;
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  fullWidth = false,
  disabled = false,
  style,
  ...selectProps
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

  const selectStyle: CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.default,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.bgPrimary,
    border: `1px solid ${error ? theme.colors.error : isFocused ? theme.colors.borderFocus : theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    outline: 'none',
    transition: `border-color ${theme.transitions.fast}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? '100%' : 'auto',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23333333' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `right ${theme.spacing.sm} center`,
    paddingRight: theme.spacing.xl,
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
      <select
        {...selectProps}
        disabled={disabled}
        style={selectStyle}
        onFocus={(e) => {
          setIsFocused(true);
          selectProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          selectProps.onBlur?.(e);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
};
