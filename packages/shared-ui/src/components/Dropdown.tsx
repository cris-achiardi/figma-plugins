import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import { theme } from '../styles/theme';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownOptionItemProps {
  option: DropdownOption;
  isSelected: boolean;
  onClick: (value: string) => void;
}

const DropdownOptionItem: React.FC<DropdownOptionItemProps> = ({ option, isSelected, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  const optionStyle: CSSProperties = {
    padding: '6px 8px',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.default,
    color: theme.colors.textPrimary,
    backgroundColor: isSelected
      ? theme.colors.bgSelected
      : isHovered
      ? theme.colors.bgHover
      : 'transparent',
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      style={optionStyle}
      onClick={() => onClick(option.value)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {option.label}
    </div>
  );
};

export interface DropdownProps {
  label?: string;
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  fullWidth?: boolean;
  style?: CSSProperties;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  error,
  fullWidth = false,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setIsFocused(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        // Navigate options
        const currentIndex = options.findIndex(opt => opt.value === value);
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.max(currentIndex - 1, 0);
        onChange?.(options[nextIndex].value);
      }
    }
  };

  const handleOptionClick = (optionValue: string) => {
    onChange?.(optionValue);
    setIsOpen(false);
    setIsFocused(false);
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    width: fullWidth ? '100%' : 'auto',
    position: 'relative',
  };

  const labelStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.default,
  };

  const buttonStyle: CSSProperties = {
    padding: '6px 8px',
    height: '30px',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.default,
    color: selectedOption ? theme.colors.textPrimary : theme.colors.textSecondary,
    backgroundColor: theme.colors.bgPrimary,
    border: `1px solid ${error ? theme.colors.error : isFocused || isOpen ? theme.colors.blue : theme.colors.border}`,
    borderRadius: '2px',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? '100%' : 'auto',
    textAlign: 'left',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    boxSizing: 'border-box',
    transition: `all ${theme.transitions.fast}`,
    ...style,
  };

  const arrowStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    transition: `transform ${theme.transitions.fast}`,
    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    flexShrink: 0,
    marginLeft: 'auto',
    color: theme.colors.textSecondary,
  };

  const menuStyle: CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.bgPrimary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '2px',
    boxShadow: theme.shadows.lg,
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 1000,
    boxSizing: 'border-box',
  };

  const errorStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily.default,
  };

  return (
    <div style={containerStyle} ref={containerRef}>
      {label && <label style={labelStyle}>{label}</label>}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        style={buttonStyle}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => !isOpen && setIsFocused(false)}
        onKeyDown={handleKeyDown}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption?.label || placeholder}
        </span>
        <svg
          style={arrowStyle}
          viewBox="0 0 8 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 2.5L4 5.5L7 2.5"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {isOpen && (
        <div style={menuStyle} role="listbox">
          {options.map((option) => (
            <DropdownOptionItem
              key={option.value}
              option={option}
              isSelected={option.value === value}
              onClick={handleOptionClick}
            />
          ))}
        </div>
      )}
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
};
