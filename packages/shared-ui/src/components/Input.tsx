import React, { CSSProperties, ChangeEvent, FocusEvent, KeyboardEvent } from 'react';
import { theme } from '../styles/theme';

export interface InputProps {
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLDivElement>) => void;
  onBlur?: (e: FocusEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  fullWidth?: boolean;
  style?: CSSProperties;
}

export const Input: React.FC<InputProps> = ({
  value = '',
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  placeholder = '',
  type = 'text',
  disabled = false,
  label,
  error,
  fullWidth = false,
  style,
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(value);
  const inputRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

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

  const inputWrapperStyle: CSSProperties = {
    display: 'block',
    boxSizing: 'border-box',
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
    height: '30px',
    margin: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    ...style,
  };

  const hiddenInputStyle: CSSProperties = {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
    width: 0,
    height: 0,
  };

  const handleWrapperClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInternalValue(e.target.value);
    onChange?.(e);
  };

  const handleFocus = (e: FocusEvent<HTMLDivElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const errorStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily.default,
  };

  const displayValue = internalValue || '';
  const showPlaceholder = !displayValue && placeholder;

  return (
    <div style={containerStyle}>
      {label && <div style={labelStyle}>{label}</div>}
      <div
        style={inputWrapperStyle}
        onClick={handleWrapperClick}
      >
        <input
          ref={inputRef as any}
          type={type}
          value={internalValue}
          onChange={handleChange}
          onFocus={handleFocus as any}
          onBlur={handleBlur as any}
          onKeyDown={onKeyDown as any}
          disabled={disabled}
          placeholder={placeholder}
          style={hiddenInputStyle}
        />
        <div style={{
          position: 'absolute',
          top: theme.spacing.xs,
          left: theme.spacing.sm,
          right: theme.spacing.sm,
          color: showPlaceholder ? theme.colors.textSecondary : theme.colors.textPrimary,
          pointerEvents: 'none',
        }}>
          {showPlaceholder ? placeholder : displayValue}
        </div>
      </div>
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
};
