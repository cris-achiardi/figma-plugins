import React, { CSSProperties, InputHTMLAttributes } from 'react';
import { theme } from '../styles/theme';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  disabled = false,
  style,
  ...inputProps
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  };

  const checkboxWrapperStyle: CSSProperties = {
    position: 'relative',
    width: '16px',
    height: '16px',
    flexShrink: 0,
  };

  const checkboxStyle: CSSProperties = {
    position: 'absolute',
    opacity: 0,
    width: '16px',
    height: '16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    margin: 0,
  };

  const customCheckboxStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '16px',
    height: '16px',
    backgroundColor: checked ? theme.colors.blue : theme.colors.bgPrimary,
    border: `1px solid ${checked ? theme.colors.blue : theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `all ${theme.transitions.fast}`,
    pointerEvents: 'none',
  };

  const checkmarkStyle: CSSProperties = {
    width: '10px',
    height: '10px',
    display: checked ? 'block' : 'none',
  };

  const labelStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.default,
    userSelect: 'none',
  };

  return (
    <label style={containerStyle}>
      <div style={checkboxWrapperStyle}>
        <input
          {...inputProps}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          style={{ ...checkboxStyle, ...style }}
        />
        <div style={customCheckboxStyle}>
          <svg
            style={checkmarkStyle}
            viewBox="0 0 10 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      {label && <span style={labelStyle}>{label}</span>}
    </label>
  );
};
