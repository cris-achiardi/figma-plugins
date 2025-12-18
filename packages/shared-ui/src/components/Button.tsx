import React, { CSSProperties } from 'react';
import { theme } from '../styles/theme';

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'tertiary';
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  style,
}) => {
  const getVariantStyles = (): CSSProperties => {
    const baseStyles: CSSProperties = {
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      border: 'none',
      borderRadius: theme.borderRadius.md,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.semibold,
      fontFamily: theme.typography.fontFamily.default,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: `all ${theme.transitions.fast}`,
      outline: 'none',
      width: fullWidth ? '100%' : 'auto',
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.blue,
          color: theme.colors.textOnPrimary,
        };
      case 'secondary':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.bgSecondary,
          color: theme.colors.textPrimary,
          border: `1px solid ${theme.colors.gray650}`,
        };
      case 'tertiary':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          color: theme.colors.textPrimary,
          padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        };
      default:
        return baseStyles;
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const target = e.currentTarget;
    if (variant === 'primary') {
      target.style.backgroundColor = theme.colors.blueHover;
    } else if (variant === 'secondary') {
      target.style.backgroundColor = theme.colors.bgHover;
    } else if (variant === 'tertiary') {
      target.style.backgroundColor = theme.colors.bgHover;
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    if (variant === 'primary') {
      target.style.backgroundColor = theme.colors.blue;
    } else if (variant === 'secondary') {
      target.style.backgroundColor = theme.colors.bgPrimary;
    } else if (variant === 'tertiary') {
      target.style.backgroundColor = 'transparent';
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const target = e.currentTarget;
    if (variant === 'primary') {
      target.style.backgroundColor = theme.colors.bluePressed;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const target = e.currentTarget;
    if (variant === 'primary') {
      target.style.backgroundColor = theme.colors.blueHover;
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...getVariantStyles(), ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {children}
    </button>
  );
};
