import React, { CSSProperties, useEffect } from 'react';
import { theme } from '../styles/theme';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  showBuyMeCoffee?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = '400px',
  showBuyMeCoffee = true,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: theme.spacing.lg,
  };

  const modalStyle: CSSProperties = {
    backgroundColor: '#2C2C2C',
    borderRadius: '12px',
    width: '100%',
    maxWidth: width,
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    position: 'relative',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    paddingRight: '48px',
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.default,
  };

  const closeButtonStyle: CSSProperties = {
    position: 'absolute',
    top: '0',
    right: '8px',
    background: 'none',
    border: 'none',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    padding: 0,
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: `background-color ${theme.transitions.fast}`,
  };

  const contentStyle: CSSProperties = {
    padding: theme.spacing.lg,
  };

  const buyMeCoffeeContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: theme.spacing.md,
  };

  const buyMeCoffeeTextStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    margin: 0,
    fontFamily: theme.typography.fontFamily.default,
  };

  const buyMeCoffeeButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#FFDD00',
    color: '#000000',
    border: 'none',
    borderRadius: '8px',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    fontFamily: theme.typography.fontFamily.default,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: `transform ${theme.transitions.fast}`,
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div style={headerStyle}>
            <h2 style={titleStyle}>{title}</h2>
            <button
              style={closeButtonStyle}
              onClick={onClose}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.bgHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4L12 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}
        <div style={contentStyle}>{children}</div>
        {showBuyMeCoffee && (
          <div style={buyMeCoffeeContainerStyle}>
            <p style={buyMeCoffeeTextStyle}>Found this plugin useful?</p>
            <a
              href="https://buymeacoffee.com/giorris"
              target="_blank"
              rel="noopener noreferrer"
              style={buyMeCoffeeButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-.806-1.58a3.25 3.25 0 00-2.197-.925H6.75c-.83 0-1.623.346-2.197.925-.418.417-.687.982-.806 1.58l-.132.666A4.992 4.992 0 002 10.5c0 1.512.667 2.865 1.722 3.778V20.5c0 .828.672 1.5 1.5 1.5h13.556c.828 0 1.5-.672 1.5-1.5v-6.222A4.992 4.992 0 0022 10.5a4.992 4.992 0 00-1.784-4.085zM6.75 5.5h10.5c.414 0 .81.173 1.098.461.189.189.327.42.4.671H5.252c.073-.252.211-.482.4-.671.288-.288.684-.461 1.098-.461zm11.028 15H6.222v-5.5h11.556v5.5z"
                  fill="currentColor"
                />
              </svg>
              Buy me a coffee
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
