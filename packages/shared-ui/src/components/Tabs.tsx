import React, { CSSProperties } from 'react';
import { theme } from '../styles/theme';

export interface Tab {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (value: string) => void;
  style?: CSSProperties;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  style,
}) => {
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null);

  const containerStyle: CSSProperties = {
    display: 'flex',
    gap: theme.spacing.xs,
    borderBottom: `1px solid ${theme.colors.border}`,
    ...style,
  };

  const getTabStyle = (tab: Tab): CSSProperties => {
    const isActive = activeTab === tab.value;
    const isDisabled = tab.disabled || false;
    const isHovered = hoveredTab === tab.value;

    return {
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      border: 'none',
      borderBottom: isActive ? `2px solid ${theme.colors.blue}` : '2px solid transparent',
      background: 'none',
      color: isDisabled
        ? theme.colors.textSecondary
        : isActive || isHovered
        ? theme.colors.blue
        : theme.colors.textPrimary,
      fontWeight: isActive ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium,
      fontSize: theme.typography.fontSize.md,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.5 : 1,
      transition: `all ${theme.transitions.fast}`,
      fontFamily: theme.typography.fontFamily.default,
      margin: 0,
    };
  };

  const handleTabClick = (tab: Tab) => {
    if (!tab.disabled) {
      onChange(tab.value);
    }
  };

  const handleMouseEnter = (tab: Tab) => {
    if (!tab.disabled && activeTab !== tab.value) {
      setHoveredTab(tab.value);
    }
  };

  const handleMouseLeave = () => {
    setHoveredTab(null);
  };

  return (
    <div style={containerStyle}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => handleTabClick(tab)}
          disabled={tab.disabled}
          onMouseEnter={() => handleMouseEnter(tab)}
          onMouseLeave={handleMouseLeave}
          style={getTabStyle(tab)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
