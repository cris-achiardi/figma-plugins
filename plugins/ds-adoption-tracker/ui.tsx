import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Dropdown, Input, Checkbox, Tabs, Modal, theme } from '@figma-plugins/shared-ui';
import { Scope, ExportFormat, AnalysisResult, UIMessage, CodeMessage, ComponentStats, DetachedInstance } from './types';

const PLUGIN_VERSION = '1.0.0';

type SortBy = 'count' | 'name' | 'library';
type ActiveTab = 'instances' | 'detached';

// Stat Card Component
function StatCard({ value, label, sublabel }: { value: string | number; label: string; sublabel?: string }) {
  return (
    <div style={{
      backgroundColor: theme.colors.bgPrimary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      textAlign: 'center',
      border: `1px solid ${theme.colors.border}`,
    }}>
      <div style={{
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.textPrimary,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.textSecondary,
        marginTop: theme.spacing.xs,
      }}>
        {label}
      </div>
      {sublabel && (
        <div style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.textTertiary,
          marginTop: theme.spacing.xxs,
        }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

// Component Row
function ComponentRow({ component, onNavigate, allComponents }: {
  component: ComponentStats;
  onNavigate: (nodeId: string) => void;
  allComponents: ComponentStats[];
}) {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  // Get names of parent/nested components
  const usedInNames = component.usedInComponents
    .map(id => allComponents.find(c => c.id === id)?.name?.split('/').pop())
    .filter(Boolean)
    .slice(0, 3);

  const nestedNames = component.nestedComponents
    .map(id => allComponents.find(c => c.id === id)?.name?.split('/').pop())
    .filter(Boolean)
    .slice(0, 3);

  const handlePrev = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : component.instanceIds.length - 1;
    setCurrentIndex(newIndex);
    onNavigate(component.instanceIds[newIndex]);
  };

  const handleNext = () => {
    const newIndex = currentIndex < component.instanceIds.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    onNavigate(component.instanceIds[newIndex]);
  };

  const navButtonStyle: React.CSSProperties = {
    background: 'none',
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    color: theme.colors.textSecondary,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.fontSize.xs,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28px',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderBottom: `1px solid ${theme.colors.border}`,
    }}>
      <div style={{
        backgroundColor: theme.colors.blue,
        color: theme.colors.white,
        borderRadius: theme.borderRadius.md,
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.bold,
        minWidth: '40px',
        textAlign: 'center',
      }}>
        {component.instanceCount}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {component.name}
        </div>
        <div style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.textSecondary,
          marginTop: theme.spacing.xxs,
        }}>
          {component.libraryName || (component.isExternal ? 'External' : 'Local')}
        </div>
        {usedInNames.length > 0 && (
          <div style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.textTertiary,
            marginTop: theme.spacing.xs,
          }}>
            in: {usedInNames.join(', ')}{component.usedInComponents.length > 3 ? '...' : ''}
          </div>
        )}
        {nestedNames.length > 0 && (
          <div style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.textTertiary,
            marginTop: theme.spacing.xxs,
          }}>
            has: {nestedNames.join(', ')}{component.nestedComponents.length > 3 ? '...' : ''}
          </div>
        )}
      </div>
      {component.instanceIds.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.xs,
        }}>
          <button
            onClick={handlePrev}
            style={navButtonStyle}
            title="Previous instance"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 9L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.textTertiary,
            minWidth: '40px',
            textAlign: 'center',
          }}>
            {currentIndex + 1}/{component.instanceIds.length}
          </span>
          <button
            onClick={handleNext}
            style={navButtonStyle}
            title="Next instance"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// Detached Row
function DetachedRow({ item, onNavigate }: {
  item: DetachedInstance;
  onNavigate: (nodeId: string) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderBottom: `1px solid ${theme.colors.border}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          "{item.frameName}"
        </div>
        <div style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.textSecondary,
          marginTop: theme.spacing.xs,
        }}>
          ↳ Was: {item.originalComponentName || item.originalComponentKey || 'Unknown'}
        </div>
      </div>
      <button
        onClick={() => onNavigate(item.frameId)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: theme.spacing.xs,
          color: theme.colors.textSecondary,
          borderRadius: theme.borderRadius.sm,
        }}
        title="Select in canvas"
      >
        →
      </button>
    </div>
  );
}

// Progress Bar
function ProgressBar({ percent, message }: { percent: number; message: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: theme.spacing.md,
    }}>
      <div style={{
        width: '200px',
        height: '8px',
        backgroundColor: theme.colors.bgPrimary,
        borderRadius: theme.borderRadius.full,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percent}%`,
          height: '100%',
          backgroundColor: theme.colors.blue,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
      }}>
        {percent}%
      </div>
      <div style={{
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.textTertiary,
      }}>
        {message}
      </div>
    </div>
  );
}

function App() {
  // State
  const [scope, setScope] = React.useState<Scope>('page');
  const [hasSelection, setHasSelection] = React.useState(false);
  const [selectionCount, setSelectionCount] = React.useState(0);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [progress, setProgress] = React.useState({ percent: 0, message: '' });
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('instances');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<SortBy>('count');
  const [externalOnly, setExternalOnly] = React.useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = React.useState(false);

  // Message handler
  React.useEffect(() => {
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage as CodeMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'init':
        case 'selection-changed':
          setHasSelection(msg.hasSelection);
          setSelectionCount(msg.count);
          break;
        case 'analysis-progress':
          setProgress({ percent: msg.percent, message: msg.message });
          break;
        case 'analysis-complete':
          setIsAnalyzing(false);
          setResult(msg.result);
          setError(null);
          break;
        case 'error':
          setIsAnalyzing(false);
          setError(msg.message);
          break;
      }
    };
  }, []);

  // Handlers
  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setProgress({ percent: 0, message: 'Starting...' });

    const msg: UIMessage = { type: 'analyze', scope };
    parent.postMessage({ pluginMessage: msg }, '*');
  };

  const handleNavigate = (nodeId: string) => {
    const msg: UIMessage = { type: 'navigate', nodeId };
    parent.postMessage({ pluginMessage: msg }, '*');
  };

  const handleExport = (format: ExportFormat) => {
    if (!result) return;

    // Compact component data (id, name, instanceCount, isExternal)
    const compactComponents = result.components.map(c => ({
      id: c.id,
      name: c.name,
      instanceCount: c.instanceCount,
      isExternal: c.isExternal,
    }));

    if (format === 'json') {
      const data = {
        meta: {
          pluginVersion: PLUGIN_VERSION,
          exportedAt: result.timestamp,
          scope: result.scope,
          fileName: result.fileName,
          pageName: result.pageName,
        },
        summary: {
          totalInstances: result.totalInstances,
          uniqueComponents: result.uniqueComponents,
          externalComponents: result.externalComponents,
          localComponents: result.localComponents,
          detachedInstances: result.totalDetached,
        },
        components: compactComponents,
      };

      downloadFile(
        JSON.stringify(data, null, 2),
        `ds-adoption-${result.scope}-${new Date().toISOString().split('T')[0]}.json`,
        'application/json'
      );
    } else {
      // CSV export - single file with components
      const csv = [
        'id,name,instanceCount,isExternal',
        ...compactComponents.map(c =>
          `"${c.id}","${c.name}",${c.instanceCount},${c.isExternal}`
        )
      ].join('\n');

      downloadFile(
        csv,
        `ds-adoption-${result.scope}-${new Date().toISOString().split('T')[0]}.csv`,
        'text/csv'
      );
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter and sort components
  const filteredComponents = React.useMemo(() => {
    if (!result) return [];

    let filtered = result.components;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        (c.libraryName && c.libraryName.toLowerCase().includes(query))
      );
    }

    // External only filter
    if (externalOnly) {
      filtered = filtered.filter(c => c.isExternal);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'count':
          return b.instanceCount - a.instanceCount;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'library':
          return (a.libraryName || '').localeCompare(b.libraryName || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [result, searchQuery, sortBy, externalOnly]);

  // Scope options
  const scopeOptions = [
    { value: 'page', label: 'Current Page' },
    { value: 'file', label: 'Current File' },
    { value: 'selection', label: `Selected Frames (${selectionCount})` },
  ];

  const sortOptions = [
    { value: 'count', label: 'Instance Count' },
    { value: 'name', label: 'Name' },
    { value: 'library', label: 'Library' },
  ];

  const tabItems = [
    { value: 'instances', label: 'Instances' },
    { value: 'detached', label: 'Detached' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '300px 1fr',
      gridTemplateRows: '1fr 40px',
      height: '100%',
      fontFamily: theme.typography.fontFamily.default,
    }}>
      {/* LEFT PANEL */}
      <div style={{
        padding: theme.spacing.lg,
        borderRight: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.md,
        overflowY: 'auto',
      }}>
        {/* Scope */}
        <div>
          <div style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.xs,
          }}>
            Scope
          </div>
          <Dropdown
            value={scope}
            onChange={(v) => setScope(v as Scope)}
            options={scopeOptions}
            fullWidth
          />
        </div>

        {/* Analyze Button */}
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (scope === 'selection' && !hasSelection)}
          variant="primary"
          fullWidth
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze'}
        </Button>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: theme.colors.border }} />

        {/* Summary */}
        <div>
          <div style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.sm,
          }}>
            Summary
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: theme.spacing.sm,
          }}>
            <StatCard
              value={result?.totalInstances ?? '—'}
              label="Uses"
            />
            <StatCard
              value={result?.uniqueComponents ?? '—'}
              label="Comps"
            />
            <StatCard
              value={result?.externalComponents ?? '—'}
              label="Library"
            />
            <StatCard
              value={result?.totalDetached ?? '—'}
              label="Detached"
            />
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: theme.colors.border }} />

        {/* Export */}
        <div>
          <div style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.sm,
          }}>
            Export
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.sm }}>
            <Button
              onClick={() => handleExport('json')}
              disabled={!result}
              variant="secondary"
              style={{ flex: 1 }}
            >
              JSON
            </Button>
            <Button
              onClick={() => handleExport('csv')}
              disabled={!result}
              variant="secondary"
              style={{ flex: 1 }}
            >
              CSV
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: theme.colors.border }} />

        {/* Filters */}
        <Checkbox
          checked={externalOnly}
          onChange={(e) => setExternalOnly(e.target.checked)}
          label="External only"
        />
      </div>

      {/* RIGHT PANEL */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Tabs */}
        <div style={{ padding: `${theme.spacing.md} ${theme.spacing.lg} 0` }}>
          <Tabs
            tabs={tabItems}
            activeTab={activeTab}
            onChange={(value) => setActiveTab(value as ActiveTab)}
          />
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {isAnalyzing ? (
            <ProgressBar percent={progress.percent} message={progress.message} />
          ) : !result ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              gap: theme.spacing.md,
            }}>
              <div style={{ fontSize: theme.spacing.xxl }}>📊</div>
              <div style={{ fontSize: theme.typography.fontSize.sm, textAlign: 'center' }}>
                Select a scope and click<br />Analyze to get started
              </div>
            </div>
          ) : error ? (
            <div style={{
              padding: theme.spacing.lg,
              color: theme.colors.error,
              fontSize: theme.typography.fontSize.sm,
            }}>
              {error}
            </div>
          ) : activeTab === 'instances' ? (
            <>
              {/* Search and Sort */}
              <div style={{
                padding: theme.spacing.md,
                display: 'flex',
                gap: theme.spacing.sm,
                alignItems: 'center',
              }}>
                <div style={{ flex: 1 }}>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search components..."
                  />
                </div>
                <div style={{ width: '130px' }}>
                  <Dropdown
                    value={sortBy}
                    onChange={(v) => setSortBy(v as SortBy)}
                    options={sortOptions}
                  />
                </div>
              </div>

              {/* Component List */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                borderTop: `1px solid ${theme.colors.border}`,
              }}>
                {filteredComponents.length === 0 ? (
                  <div style={{
                    padding: theme.spacing.lg,
                    textAlign: 'center',
                    color: theme.colors.textSecondary,
                  }}>
                    No components found
                  </div>
                ) : (
                  filteredComponents.map((component) => (
                    <ComponentRow
                      key={component.id}
                      component={component}
                      onNavigate={handleNavigate}
                      allComponents={result.components}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              {/* Detached Header */}
              <div style={{
                padding: theme.spacing.md,
                borderBottom: `1px solid ${theme.colors.border}`,
              }}>
                {result.totalDetached > 0 ? (
                  <>
                    <div style={{
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.medium,
                      color: theme.colors.warning,
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing.xs,
                    }}>
                      ⚠️ {result.totalDetached} detached instances
                    </div>
                    <div style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.textSecondary,
                      marginTop: theme.spacing.xs,
                    }}>
                      Frames disconnected from DS. Consider reconnecting.
                    </div>
                  </>
                ) : (
                  <div style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.success,
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                  }}>
                    ✓ No detached instances found
                  </div>
                )}
              </div>

              {/* Detached List */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
              }}>
                {result.detachedInstances.map((item) => (
                  <DetachedRow
                    key={item.frameId}
                    item={item}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Footer - spans both columns */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `0 ${theme.spacing.lg}`,
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
        title="About DS Adoption Tracker"
        width="400px"
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
            Measure component adoption across your Figma files. Track instances,
            detect detached components, and export data for reporting and analysis.
          </p>

          <div>
            <div style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.sm,
            }}>
              Features:
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: theme.spacing.lg,
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.textSecondary,
              lineHeight: theme.typography.lineHeight.relaxed,
            }}>
              <li>Count component instances by scope</li>
              <li>Track nested component dependencies</li>
              <li>Detect detached instances (component drift)</li>
              <li>Export as JSON or CSV</li>
            </ul>
          </div>

          <div style={{
            borderTop: `1px solid ${theme.colors.border}`,
            paddingTop: theme.spacing.lg,
            fontSize: theme.typography.fontSize.sm,
          }}>
            <div>
              <strong>Created by:</strong> Cristian Morales Achiardi
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Add global styles
const style = document.createElement('style');
style.textContent = `
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
  }
`;
document.head.appendChild(style);

// Mount React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
