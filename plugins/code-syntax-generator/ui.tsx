import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Dropdown, Input, Checkbox, Modal, theme } from '@figma-plugins/shared-ui';

const PLUGIN_VERSION = '1.0.0';

console.log('UI script executing');

interface Collection {
  id: string;
  name: string;
}

type Platform = 'WEB' | 'iOS' | 'ANDROID';
type NamingConvention = 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase';

function App() {
  console.log('App component rendering');
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = React.useState('');
  const [platforms, setPlatforms] = React.useState<Record<Platform, boolean>>({
    WEB: true,
    iOS: false,
    ANDROID: false
  });
  const [conventions, setConventions] = React.useState<Record<Platform, NamingConvention>>({
    WEB: 'camelCase',
    iOS: 'camelCase',
    ANDROID: 'snake_case'
  });
  const [prefix, setPrefix] = React.useState('');
  const [normalizePrefix, setNormalizePrefix] = React.useState(true);
  const [status, setStatus] = React.useState<{
    type: 'success' | 'processing' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isAboutModalOpen, setIsAboutModalOpen] = React.useState(false);

  React.useEffect(() => {
    // Request collections list on mount
    parent.postMessage({ pluginMessage: { type: 'get-collections' } }, '*');

    // Listen for messages from plugin
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;

      if (msg.type === 'collections-list') {
        setCollections(msg.collections);
        // Auto-select first collection if available
        if (msg.collections.length > 0) {
          setSelectedCollection(msg.collections[0].id);
        }
      }

      if (msg.type === 'complete') {
        setStatus({
          type: 'success',
          message: `✓ Updated ${msg.count} variables with code syntax`
        });
      }

      if (msg.type === 'error') {
        setStatus({
          type: 'error',
          message: `Error: ${msg.message}`
        });
      }
    };
  }, []);

  const handlePlatformToggle = (platform: Platform) => {
    setPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  const handleConventionChange = (platform: Platform, convention: NamingConvention) => {
    setConventions(prev => ({
      ...prev,
      [platform]: convention
    }));
  };

  const handleApply = () => {
    // Get enabled platforms
    const enabledPlatforms = (Object.keys(platforms) as Platform[])
      .filter(platform => platforms[platform]);

    if (enabledPlatforms.length === 0) {
      setStatus({
        type: 'error',
        message: 'Please select at least one platform'
      });
      return;
    }

    // Send message to plugin
    parent.postMessage({
      pluginMessage: {
        type: 'apply-code-syntax',
        collectionId: selectedCollection,
        platforms: enabledPlatforms,
        conventions,
        prefix: prefix.trim(),
        normalizePrefix
      }
    }, '*');

    setStatus({
      type: 'processing',
      message: 'Processing variables...'
    });
  };

  const canApply = selectedCollection && Object.values(platforms).some(Boolean);

  const namingConventionOptions = [
    { value: 'camelCase', label: 'camelCase' },
    { value: 'snake_case', label: 'snake_case' },
    { value: 'kebab-case', label: 'kebab-case' },
    { value: 'PascalCase', label: 'PascalCase' },
  ];

  return (
    <div style={{
      padding: theme.spacing.lg,
      fontFamily: theme.typography.fontFamily.default,
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.lg,
        flex: 1,
      }}>

      <Dropdown
        label="Variable Collection"
        value={selectedCollection}
        onChange={value => setSelectedCollection(value)}
        options={collections.length === 0
          ? [{ value: '', label: 'No collections found' }]
          : collections.map(c => ({ value: c.id, label: c.name }))
        }
        fullWidth
      />

      <fieldset style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        margin: 0,
      }}>
        <legend style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.textPrimary,
          padding: `0 ${theme.spacing.xs}`,
        }}>
          Platforms & Naming Conventions
        </legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          {(Object.keys(platforms) as Platform[]).map(platform => {
            const platformLabels: Record<Platform, string> = {
              WEB: 'Web',
              iOS: 'iOS',
              ANDROID: 'Android',
            };

            return (
              <div key={platform} style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: theme.spacing.md,
                minHeight: '30px',
              }}>
                <Checkbox
                  checked={platforms[platform]}
                  onChange={() => handlePlatformToggle(platform)}
                  label={platformLabels[platform]}
                />
                {platforms[platform] && (
                  <Dropdown
                    value={conventions[platform]}
                    onChange={value => handleConventionChange(
                      platform,
                      value as NamingConvention
                    )}
                    options={namingConventionOptions}
                    style={{ minWidth: '140px' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <Input
        label="Prefix (optional)"
        type="text"
        value={prefix}
        onChange={e => setPrefix(e.target.value)}
        placeholder="One or multiple words separated by spaces"
        fullWidth
      />

      {prefix && (
        <Checkbox
          checked={normalizePrefix}
          onChange={e => setNormalizePrefix(e.target.checked)}
          label="Normalize prefix to match naming convention"
        />
      )}

      <Button
        onClick={handleApply}
        disabled={!canApply}
        variant="primary"
        fullWidth
      >
        Apply Code Syntax
      </Button>

      {status.type && (
        <div style={{
          padding: theme.spacing.sm,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.fontSize.sm,
          backgroundColor: status.type === 'success'
            ? theme.colors.success + '20'
            : status.type === 'error'
            ? theme.colors.error + '20'
            : theme.colors.blue + '20',
          color: status.type === 'success'
            ? theme.colors.success
            : status.type === 'error'
            ? theme.colors.error
            : theme.colors.blue,
          border: `1px solid ${
            status.type === 'success'
              ? theme.colors.success
              : status.type === 'error'
              ? theme.colors.error
              : theme.colors.blue
          }`,
        }}>
          {status.message}
        </div>
      )}
      </div>

      {/* Footer with version and info icon */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: theme.spacing.md,
        borderTop: `1px solid ${theme.colors.border}`,
      }}>
        <span style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.textSecondary,
          fontFamily: theme.typography.fontFamily.default,
        }}>
          v{PLUGIN_VERSION}
        </span>
        <button
          onClick={() => setIsAboutModalOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            color: theme.colors.textSecondary,
            transition: `all ${theme.transitions.fast}`,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.bgHover;
            e.currentTarget.style.color = theme.colors.textPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1" />
            <path d="M8 7V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="5" r="0.5" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* About Modal */}
      <Modal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        title="About Code Syntax Generator"
        width="440px"
        showBuyMeCoffee={true}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.lg,
        }}>
          <p style={{
            margin: 0,
            fontSize: theme.typography.fontSize.sm,
            lineHeight: theme.typography.lineHeight.relaxed,
            color: theme.colors.textPrimary,
            fontFamily: theme.typography.fontFamily.default,
          }}>
            This plugin allows you add code syntax to Figma variables in seconds. Show the actual token name in dev mode and superpower the Figma MCP with machine readable metadata that AI can use to consume your design system.
          </p>

          <div style={{
            borderTop: `1px solid ${theme.colors.border}`,
            paddingTop: theme.spacing.lg,
          }}>
            <div style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.fontFamily.default,
            }}>
              <p style={{ margin: `0 0 ${theme.spacing.sm} 0` }}>
                <strong>Created by:</strong>
              </p>
              <p style={{ margin: `0 0 ${theme.spacing.md} 0` }}>
                Cristian Morales Achiardi
              </p>
              <div style={{
                display: 'flex',
                gap: theme.spacing.sm,
                flexWrap: 'wrap',
              }}>
                <a
                  href="https://www.linkedin.com/in/cristian-morales-achiardi/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    backgroundColor: theme.colors.bgHover,
                    borderRadius: theme.borderRadius.md,
                    color: theme.colors.textPrimary,
                    textDecoration: 'none',
                    fontSize: theme.typography.fontSize.sm,
                    transition: `background-color ${theme.transitions.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgBrandHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgHover;
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </a>
                <a
                  href="https://github.com/cris-achiardi"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    backgroundColor: theme.colors.bgHover,
                    borderRadius: theme.borderRadius.md,
                    color: theme.colors.textPrimary,
                    textDecoration: 'none',
                    fontSize: theme.typography.fontSize.sm,
                    transition: `background-color ${theme.transitions.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgBrandHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgHover;
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </a>
                <a
                  href="https://www.giorris.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    backgroundColor: theme.colors.bgHover,
                    borderRadius: theme.borderRadius.md,
                    color: theme.colors.textPrimary,
                    textDecoration: 'none',
                    fontSize: theme.typography.fontSize.sm,
                    transition: `background-color ${theme.transitions.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgBrandHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgHover;
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  Website
                </a>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Add global styles for full height layout
const style = document.createElement('style');
style.textContent = `
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
  }
`;
document.head.appendChild(style);

console.log('Looking for root element...');
const container = document.getElementById('root');
console.log('Root element:', container);

if (container) {
  console.log('Creating React root...');
  const root = createRoot(container);
  console.log('Rendering App...');
  root.render(<App />);
} else {
  console.error('Root element not found!');
}
