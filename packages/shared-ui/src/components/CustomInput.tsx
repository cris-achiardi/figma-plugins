import React, { CSSProperties, ChangeEvent } from 'react';
import { theme } from '../styles/theme';

export interface CustomInputProps {
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  fullWidth?: boolean;
  style?: CSSProperties;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  value = '',
  onChange,
  placeholder = '',
  disabled = false,
  label,
  error,
  fullWidth = false,
  style,
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const editableRef = React.useRef<HTMLDivElement>(null);

  // Sync external value changes
  React.useEffect(() => {
    if (editableRef.current && editableRef.current.textContent !== value) {
      editableRef.current.textContent = value;
    }
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

  const editableStyle: CSSProperties = {
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
    lineHeight: '22px', // 30px height - 8px padding = 22px for vertical centering
    ...style,
  };

  const placeholderStyle: CSSProperties = {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.default,
    color: theme.colors.textTertiary,
    lineHeight: '22px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  };

  const errorStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily.default,
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newValue = e.currentTarget.textContent || '';
    if (onChange) {
      const syntheticEvent = {
        target: { value: newValue },
        currentTarget: { value: newValue },
      } as ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const showPlaceholder = !value && placeholder;

  return (
    <div style={containerStyle}>
      {label && <div style={labelStyle}>{label}</div>}
      <div style={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
        <div
          ref={editableRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={editableStyle}
          suppressContentEditableWarning
        />
        {showPlaceholder && (
          <div style={placeholderStyle}>
            {placeholder}
          </div>
        )}
      </div>
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
};
