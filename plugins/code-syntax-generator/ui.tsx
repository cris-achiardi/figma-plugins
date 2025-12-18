import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Dropdown, Input, Checkbox, Modal, theme } from '@figma-plugins/shared-ui';
import packageJson from './package.json';

const PLUGIN_VERSION = packageJson.version;

console.log('UI script executing');

interface Collection {
  id: string;
  name: string;
}

type Platform = 'WEB' | 'iOS' | 'ANDROID';
type NamingConvention = 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase';

interface PreviewItem {
  original: string;
  generated: string;
}

function App() {
  console.log('App component rendering');

  // Collections
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = React.useState('');

  // Platform states
  const [platforms, setPlatforms] = React.useState<Record<Platform, boolean>>({
    WEB: false,
    iOS: false,
    ANDROID: false
  });

  const [conventions, setConventions] = React.useState<Record<Platform, NamingConvention>>({
    WEB: 'kebab-case',
    iOS: 'camelCase',
    ANDROID: 'snake_case'
  });

  // Template states (per platform)
  const [templatePrefixes, setTemplatePrefixes] = React.useState<Record<Platform, string>>({
    WEB: '',
    iOS: '',
    ANDROID: ''
  });

  const [templateSuffixes, setTemplateSuffixes] = React.useState<Record<Platform, string>>({
    WEB: '',
    iOS: '',
    ANDROID: ''
  });

  // Preview states (per platform)
  const [previews, setPreviews] = React.useState<Record<Platform, PreviewItem[]>>({
    WEB: [],
    iOS: [],
    ANDROID: []
  });

  const [previewTotals, setPreviewTotals] = React.useState<Record<Platform, number>>({
    WEB: 0,
    iOS: 0,
    ANDROID: 0
  });

  const [previewExpanded, setPreviewExpanded] = React.useState<Record<Platform, boolean>>({
    WEB: false,
    iOS: false,
    ANDROID: false
  });

  const [existingSyntax, setExistingSyntax] = React.useState<Record<Platform, string[]>>({
    WEB: [],
    iOS: [],
    ANDROID: []
  });

  const [hasExistingSyntax, setHasExistingSyntax] = React.useState<Record<Platform, boolean>>({
    WEB: false,
    iOS: false,
    ANDROID: false
  });

  // UI states
  const [activeTab, setActiveTab] = React.useState<Platform>('WEB');
  const [removeMode, setRemoveMode] = React.useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = React.useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = React.useState(false);

  const [status, setStatus] = React.useState<{
    type: 'success' | 'processing' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Load collections on mount
  React.useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'get-collections' } }, '*');

    // Listen for messages from plugin
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;

      if (msg.type === 'collections-list') {
        setCollections(msg.collections);
        if (msg.collections.length > 0) {
          setSelectedCollection(msg.collections[0].id);
        }
      }

      if (msg.type === 'existing-syntax-found') {
        setExistingSyntax(msg.existingSyntax);
        setHasExistingSyntax(msg.hasExisting);

        // Show existing syntax in preview for platforms that have it
        Object.keys(msg.existingSyntax).forEach((platform) => {
          const platformKey = platform as Platform;
          if (msg.hasExisting[platformKey]) {
            setPreviews(prev => ({
              ...prev,
              [platformKey]: msg.existingSyntax[platformKey].slice(0, 20).map((syntax: string) => ({
                original: '',
                generated: syntax
              }))
            }));
            setPreviewTotals(prev => ({
              ...prev,
              [platformKey]: msg.existingSyntax[platformKey].length
            }));
          }
        });
      }

      if (msg.type === 'preview-result') {
        setPreviews(prev => ({
          ...prev,
          [msg.platform]: msg.previews
        }));
        setPreviewTotals(prev => ({
          ...prev,
          [msg.platform]: msg.total
        }));
        setIsGeneratingPreview(false);
      }

      if (msg.type === 'apply-complete') {
        setStatus({
          type: 'success',
          message: `✓ Code syntax applied to ${msg.count} variables (${msg.platforms.join(', ')})`
        });
      }

      if (msg.type === 'remove-complete') {
        setStatus({
          type: 'success',
          message: `✓ Code syntax removed from ${msg.count} variables (${msg.platforms.join(', ')})`
        });
        // Clear previews for removed platforms
        msg.platforms.forEach((platform: Platform) => {
          setPreviews(prev => ({
            ...prev,
            [platform]: []
          }));
          setPreviewTotals(prev => ({
            ...prev,
            [platform]: 0
          }));
        });
      }

      if (msg.type === 'error') {
        setStatus({
          type: 'error',
          message: `Error: ${msg.message}`
        });
        setIsGeneratingPreview(false);
      }
    };
  }, []);

  // Load collection when selected
  React.useEffect(() => {
    if (selectedCollection) {
      parent.postMessage({
        pluginMessage: {
          type: 'load-collection',
          collectionId: selectedCollection
        }
      }, '*');

      // Load templates from localStorage
      loadTemplatesFromStorage(selectedCollection);
    }
  }, [selectedCollection]);

  // Save templates to localStorage when they change
  React.useEffect(() => {
    if (selectedCollection) {
      saveTemplatesToStorage(selectedCollection);
    }
  }, [selectedCollection, templatePrefixes, templateSuffixes, conventions]);

  // Handlers
  const handlePlatformToggle = (platform: Platform) => {
    const newValue = !platforms[platform];
    setPlatforms(prev => ({
      ...prev,
      [platform]: newValue
    }));

    // Auto-switch to this tab if enabled
    if (newValue) {
      setActiveTab(platform);
    }
  };

  const handleConventionChange = (platform: Platform, convention: NamingConvention) => {
    setConventions(prev => ({
      ...prev,
      [platform]: convention
    }));
  };

  const handleTemplatePrefixChange = (platform: Platform, value: string) => {
    setTemplatePrefixes(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  const handleTemplateSuffixChange = (platform: Platform, value: string) => {
    setTemplateSuffixes(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  const handleApplyTemplate = () => {
    if (!selectedCollection) return;

    setIsGeneratingPreview(true);
    const limit = previewExpanded[activeTab] ? 1000 : 20;

    parent.postMessage({
      pluginMessage: {
        type: 'generate-preview',
        collectionId: selectedCollection,
        platform: activeTab,
        convention: conventions[activeTab],
        prefix: templatePrefixes[activeTab],
        suffix: templateSuffixes[activeTab],
        limit
      }
    }, '*');
  };

  const handleTogglePreviewExpand = () => {
    const newExpanded = !previewExpanded[activeTab];
    setPreviewExpanded(prev => ({
      ...prev,
      [activeTab]: newExpanded
    }));

    // Regenerate preview with new limit
    if (newExpanded && selectedCollection) {
      setIsGeneratingPreview(true);
      parent.postMessage({
        pluginMessage: {
          type: 'generate-preview',
          collectionId: selectedCollection,
          platform: activeTab,
          convention: conventions[activeTab],
          prefix: templatePrefixes[activeTab],
          suffix: templateSuffixes[activeTab],
          limit: 1000
        }
      }, '*');
    } else if (selectedCollection) {
      // Show less: just slice existing preview
      setPreviews(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].slice(0, 20)
      }));
    }
  };

  const handleGenerate = () => {
    const enabledPlatforms = (Object.keys(platforms) as Platform[])
      .filter(platform => platforms[platform]);

    if (enabledPlatforms.length === 0) {
      setStatus({
        type: 'error',
        message: 'Please select at least one platform'
      });
      return;
    }

    parent.postMessage({
      pluginMessage: {
        type: 'apply-code-syntax',
        collectionId: selectedCollection,
        platforms: enabledPlatforms,
        conventions,
        prefixes: templatePrefixes,
        suffixes: templateSuffixes
      }
    }, '*');

    setStatus({
      type: 'processing',
      message: 'Applying code syntax...'
    });
  };

  const handleRemove = () => {
    const enabledPlatforms = (Object.keys(platforms) as Platform[])
      .filter(platform => platforms[platform]);

    console.log('handleRemove called', {
      selectedCollection,
      platforms,
      enabledPlatforms
    });

    if (enabledPlatforms.length === 0) {
      setStatus({
        type: 'error',
        message: 'Please select at least one platform to remove'
      });
      return;
    }

    console.log('Sending remove-code-syntax message:', {
      collectionId: selectedCollection,
      platforms: enabledPlatforms
    });

    parent.postMessage({
      pluginMessage: {
        type: 'remove-code-syntax',
        collectionId: selectedCollection,
        platforms: enabledPlatforms
      }
    }, '*');

    setStatus({
      type: 'processing',
      message: 'Removing code syntax...'
    });
  };

  // LocalStorage functions
  const saveTemplatesToStorage = (collectionId: string) => {
    try {
      const key = 'code-syntax-generator-templates';
      const stored = JSON.parse(localStorage.getItem(key) || '{}');

      if (!stored[collectionId]) {
        stored[collectionId] = {};
      }

      (Object.keys(platforms) as Platform[]).forEach(platform => {
        stored[collectionId][platform] = {
          prefix: templatePrefixes[platform],
          suffix: templateSuffixes[platform],
          convention: conventions[platform]
        };
      });

      localStorage.setItem(key, JSON.stringify(stored));
    } catch (error) {
      console.error('Failed to save templates to localStorage:', error);
    }
  };

  const loadTemplatesFromStorage = (collectionId: string) => {
    try {
      const key = 'code-syntax-generator-templates';
      const stored = JSON.parse(localStorage.getItem(key) || '{}');

      if (stored[collectionId]) {
        const templates = stored[collectionId];

        (Object.keys(platforms) as Platform[]).forEach(platform => {
          if (templates[platform]) {
            setTemplatePrefixes(prev => ({
              ...prev,
              [platform]: templates[platform].prefix || ''
            }));
            setTemplateSuffixes(prev => ({
              ...prev,
              [platform]: templates[platform].suffix || ''
            }));
            setConventions(prev => ({
              ...prev,
              [platform]: templates[platform].convention || conventions[platform]
            }));
          }
        });
      }
    } catch (error) {
      console.error('Failed to load templates from localStorage:', error);
    }
  };

  const namingConventionOptions = [
    { value: 'camelCase', label: 'camelCase' },
    { value: 'snake_case', label: 'snake_case' },
    { value: 'kebab-case', label: 'kebab-case' },
    { value: 'PascalCase', label: 'PascalCase' },
  ];

  const platformLabels: Record<Platform, string> = {
    WEB: 'Web',
    iOS: 'iOS',
    ANDROID: 'Android',
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '340px 1fr',
      gridTemplateRows: '1fr auto',
      height: '100%',
      fontFamily: theme.typography.fontFamily.default,
      gap: 0,
    }}>
      {/* LEFT PANEL */}
      <div style={{
        padding: theme.spacing.lg,
        borderRight: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.lg,
        overflowY: 'auto',
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
            {(Object.keys(platforms) as Platform[]).map(platform => (
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
            ))}
          </div>
        </fieldset>

        <Checkbox
          checked={removeMode}
          onChange={e => setRemoveMode(e.target.checked)}
          label="Remove code syntax from selected collection"
        />
      </div>

      {/* RIGHT PANEL */}
      <div style={{
        padding: theme.spacing.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.lg,
        overflowY: 'auto',
      }}>
        {removeMode ? (
          <>
            {/* Remove Mode Content */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: theme.spacing.lg,
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.textPrimary,
              }}>
                Remove Code Syntax
              </div>
              <div style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.textSecondary,
                maxWidth: '400px',
              }}>
                This will remove code syntax from all variables in the selected collection for the checked platforms.
              </div>
              <Button
                onClick={handleRemove}
                disabled={!selectedCollection || !Object.values(platforms).some(Boolean)}
                variant="primary"
                style={{ minWidth: '200px' }}
              >
                Remove Code Syntax
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Platform Tabs */}
            <div style={{
              display: 'flex',
              gap: theme.spacing.xs,
              borderBottom: `1px solid ${theme.colors.border}`,
            }}>
              {(Object.keys(platforms) as Platform[]).map(platform => {
                const isEnabled = platforms[platform];
                const isActive = activeTab === platform && isEnabled;

                return (
                  <button
                    key={platform}
                    onClick={() => isEnabled && setActiveTab(platform)}
                    disabled={!isEnabled}
                    style={{
                      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      border: 'none',
                      borderBottom: isActive ? `2px solid ${theme.colors.blue}` : '2px solid transparent',
                      background: 'none',
                      color: isEnabled ? (isActive ? theme.colors.blue : theme.colors.textPrimary) : theme.colors.textSecondary,
                      fontWeight: isActive ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium,
                      fontSize: theme.typography.fontSize.md,
                      cursor: isEnabled ? 'pointer' : 'not-allowed',
                      opacity: isEnabled ? 1 : 0.5,
                      transition: `all ${theme.transitions.fast}`,
                      fontFamily: theme.typography.fontFamily.default,
                    }}
                    onMouseEnter={(e) => {
                      if (isEnabled && !isActive) {
                        e.currentTarget.style.color = theme.colors.blue;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isEnabled && !isActive) {
                        e.currentTarget.style.color = theme.colors.textPrimary;
                      }
                    }}
                  >
                    {platformLabels[platform]}
                  </button>
                );
              })}
            </div>

            {/* Template Input */}
            <div>
              <label style={{
                display: 'block',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.textPrimary,
                marginBottom: theme.spacing.lg,
              }}>
                Custom Template
              </label>
              <div style={{
                display: 'flex',
                gap: theme.spacing.sm,
                alignItems: 'center',
              }}>
                {/* Combined Template Field */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  padding: theme.spacing.sm,
                  backgroundColor: theme.colors.bgPrimary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  height: '30px',
                  flex: 1,
                }}>
                  <input
                    type="text"
                    value={templatePrefixes[activeTab]}
                    onChange={e => handleTemplatePrefixChange(activeTab, e.target.value)}
                    placeholder="vars(--ds-"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.md,
                      fontFamily: theme.typography.fontFamily.mono,
                      minWidth: '60px',
                    }}
                  />
                  <div style={{
                    padding: '2px',
                    backgroundColor: '#1E1E1E',
                    borderRadius: '4px',
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.white,
                    fontWeight: theme.typography.fontWeight.semibold,
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}>
                    {'{token}'}
                  </div>
                  <input
                    type="text"
                    value={templateSuffixes[activeTab]}
                    onChange={e => handleTemplateSuffixChange(activeTab, e.target.value)}
                    placeholder=")"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.md,
                      fontFamily: theme.typography.fontFamily.mono,
                      minWidth: '60px',
                    }}
                  />
                </div>
                <Button
                  onClick={handleApplyTemplate}
                  disabled={!selectedCollection || !platforms[activeTab]}
                  variant="primary"
                  style={{ height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', margin: 0 }}
                >
                  {isGeneratingPreview ? 'Generating...' : 'Apply Template'}
                </Button>
              </div>
            </div>

            {/* Preview Panel */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: theme.spacing.sm,
              }}>
                <label style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.textPrimary,
                }}>
                  {hasExistingSyntax[activeTab] && previews[activeTab].length > 0 && previews[activeTab][0].original === ''
                    ? 'Preview - Existing Code Syntax'
                    : `Preview (showing ${previews[activeTab].length} of ${previewTotals[activeTab]})`
                  }
                </label>
                {previews[activeTab].length > 0 && previewTotals[activeTab] > 20 && (
                  <Button
                    onClick={handleTogglePreviewExpand}
                    variant="tertiary"
                  >
                    {previewExpanded[activeTab] ? 'Show Less' : 'Preview All'}
                  </Button>
                )}
              </div>

              <div style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing.md,
                minHeight: '200px',
                maxHeight: '400px',
                overflowY: 'auto',
                backgroundColor: theme.colors.bgSecondary,
                fontFamily: theme.typography.fontFamily.mono,
                fontSize: theme.typography.fontSize.sm,
              }}>
                {previews[activeTab].length === 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: theme.colors.textSecondary,
                    fontFamily: theme.typography.fontFamily.default,
                  }}>
                    Click "Apply Template" to generate preview
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: theme.spacing.xs,
                  }}>
                    {previews[activeTab].map((item, index) => (
                      <div key={index} style={{
                        color: theme.colors.textPrimary,
                        wordBreak: 'break-all',
                      }}>
                        {item.generated}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {hasExistingSyntax[activeTab] && previews[activeTab].length > 0 && previews[activeTab][0].original === '' && (
                <div style={{
                  marginTop: theme.spacing.sm,
                  padding: theme.spacing.sm,
                  backgroundColor: theme.colors.blue + '10',
                  border: `1px solid ${theme.colors.blue}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.textSecondary,
                  display: 'flex',
                  gap: theme.spacing.xs,
                }}>
                  <span>ℹ️</span>
                  <span>Showing existing code syntax. Edit template and click "Apply Template" to preview changes.</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedCollection || !Object.values(platforms).some(Boolean)}
              variant="primary"
              fullWidth
            >
              Generate Code Syntax
            </Button>
          </>
        )}

        {/* Status Message */}
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

      {/* Footer with version and info icon - spans both columns */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.lg,
        borderTop: `1px solid ${theme.colors.border}`,
      }}>
        <span style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.textSecondary,
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
                    transition: `background-color ${theme.transitions.fast}, color ${theme.transitions.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgBrandHover;
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgHover;
                    e.currentTarget.style.color = theme.colors.textPrimary;
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
                    transition: `background-color ${theme.transitions.fast}, color ${theme.transitions.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgBrandHover;
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgHover;
                    e.currentTarget.style.color = theme.colors.textPrimary;
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
                    transition: `background-color ${theme.transitions.fast}, color ${theme.transitions.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgBrandHover;
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.bgHover;
                    e.currentTarget.style.color = theme.colors.textPrimary;
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
