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
    padding: '6px 24px 6px 8px',
    height: '30px',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.default,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.bgPrimary,
    border: `1px solid ${error ? theme.colors.error : isFocused ? theme.colors.blue : theme.colors.border}`,
    borderRadius: '2px',
    outline: 'none',
    transition: `all ${theme.transitions.fast}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? '100%' : 'auto',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='8' viewBox='0 0 8 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 2.5L4 5.5L7 2.5' stroke='${encodeURIComponent(theme.colors.textSecondary)}' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    boxSizing: 'border-box',
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
