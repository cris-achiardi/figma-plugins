import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Plus, ChevronRight, Check, Star, X, Circle } from 'lucide-react';
import { buildDiffLines } from './diff-utils';
import type { DiffLine } from './diff-utils';
import { getVersionSnapshots } from '../../lib/data';

// ----- Types -----

interface VersionSlim {
  id: string;
  version: string;
  status: string;
  bump_type: string | null;
  changelog_message: string | null;
  thumbnail_url: string | null;
  property_definitions: any;
  variables_used: any;
  diff: any | null;
  created_by: string;
  reviewed_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  performed_by: string;
  note: string | null;
  created_at: string;
}

interface Props {
  version: VersionSlim;
  auditLog: AuditEntry[];
  allVersions: VersionSlim[];
  onClose: () => void;
}

// ----- Constants -----

type Tab = 'overview' | 'activity' | 'changes';

const statusColors: Record<string, string> = {
  published: '#4ade80',
  draft: '#fbbf24',
  in_review: '#60a5fa',
  approved: '#4ade80',
  deprecated: '#78716c',
};

const statusLabels: Record<string, string> = {
  published: 'published',
  draft: 'draft',
  in_review: 'in review',
  approved: 'approved',
  deprecated: 'deprecated',
};

const actionConfig: Record<string, { icon: ReactNode; label: string; color: string }> = {
  created: { icon: <Plus size={11} />, label: 'Draft created', color: '#fbbf24' },
  submitted_for_review: { icon: <ChevronRight size={11} />, label: 'Submitted for review', color: '#60a5fa' },
  approved: { icon: <Check size={11} />, label: 'Approved', color: '#4ade80' },
  published: { icon: <Star size={11} />, label: 'Published', color: '#4ade80' },
  rejected: { icon: <X size={11} />, label: 'Rejected', color: '#f87171' },
};

// ----- Helpers -----

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ----- Sub-components -----

function StatusPill({ status }: { status: string }) {
  const color = statusColors[status] || 'var(--text-muted)';
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 12,
      padding: '2px 10px',
      borderRadius: 9999,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      color,
      background: `${color}1a`,
    }}>
      {statusLabels[status] || status}
    </span>
  );
}

// ----- Main Component -----

export default function VersionDetailModal({ version, auditLog, allVersions, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const backdropRef = useRef<HTMLDivElement>(null);

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'activity', label: 'Activity' },
    { key: 'changes', label: 'Changes' },
  ];

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: 720,
        height: '100%',
        maxHeight: 600,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--text-primary)',
            }}>
              {version.version}
            </span>
            <StatusPill status={version.status} />
            {version.bump_type && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {version.bump_type}
              </span>
            )}
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '4px 6px',
              borderRadius: 'var(--radius-sm)', transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: activeTab === t.key ? 600 : 400,
                color: activeTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === t.key ? '2px solid var(--text-primary)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
              onMouseEnter={e => { if (activeTab !== t.key) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (activeTab !== t.key) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="thin-scrollbar" style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
          {activeTab === 'overview' && (
            <OverviewTab version={version} />
          )}
          {activeTab === 'activity' && (
            <ActivityTab auditLog={auditLog} />
          )}
          {activeTab === 'changes' && (
            <ChangesTab version={version} allVersions={allVersions} />
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== OVERVIEW TAB =====================

function OverviewTab({ version }: { version: VersionSlim }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Thumbnail */}
      {version.thumbnail_url && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: 16,
          }}>
            <img src={version.thumbnail_url} alt="Current" style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 'var(--radius-sm)' }} />
          </div>
        </div>
      )}

      {/* Changelog message */}
      {version.changelog_message && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 14,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Release Notes
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5 }}>
            {version.changelog_message}
          </div>
        </div>
      )}

      {/* Metadata grid */}
      <MetadataGrid version={version} />

      {/* Properties table */}
      <PropertiesTable properties={version.property_definitions} />

    </div>
  );
}

function MetadataGrid({ version }: { version: VersionSlim }) {
  const items = [
    { label: 'Created', value: formatDate(version.created_at) },
    { label: 'Updated', value: formatDate(version.updated_at) },
    { label: 'Author', value: version.created_by || '—' },
    { label: 'Reviewer', value: version.reviewed_by || '—' },
  ];
  if (version.published_at) {
    items.push({ label: 'Published', value: formatDate(version.published_at) });
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '10px 20px',
    }}>
      {items.map(item => (
        <div key={item.label}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {item.label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertiesTable({ properties }: { properties: any }) {
  if (!properties || typeof properties !== 'object' || Object.keys(properties).length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Properties
      </div>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' }}>
                Name
              </th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' }}>
                Type
              </th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' }}>
                Options
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(properties).map(([key, prop]: [string, any]) => {
              const type = prop?.type || '—';
              const options = prop?.variantOptions?.join(', ') || prop?.defaultValue || '—';
              return (
                <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{key}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>{type}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>{options}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================== ACTIVITY TAB =====================

function ActivityTab({ auditLog }: { auditLog: AuditEntry[] }) {
  if (auditLog.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 16px' }}>
        No activity recorded
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {auditLog.map((entry, i) => {
        const config = actionConfig[entry.action] || { icon: <Circle size={11} />, label: entry.action, color: 'var(--text-muted)' };
        return (
          <div key={entry.id} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 0',
            borderBottom: i < auditLog.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{
              flexShrink: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${config.color}`,
              borderRadius: '50%',
              color: config.color,
              fontSize: 11,
              fontWeight: 700,
              marginTop: 2,
            }}>
              {config.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {entry.performed_by}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {config.label}
                </span>
              </div>
              {entry.note && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  {entry.note}
                </div>
              )}
            </div>
            <span style={{ flexShrink: 0, color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
              {timeAgo(entry.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ===================== CHANGES TAB =====================

const diffColors: Record<string, { bg: string; fg: string; prefix: string }> = {
  added: { bg: 'rgba(16,185,129,0.06)', fg: '#10b981', prefix: '+' },
  changed: { bg: 'rgba(245,158,11,0.06)', fg: '#f59e0b', prefix: '~' },
  removed: { bg: 'rgba(239,68,68,0.06)', fg: '#ef4444', prefix: '-' },
};

function ChangesTab({ version, allVersions }: { version: VersionSlim; allVersions: VersionSlim[] }) {
  const otherVersions = allVersions.filter(v => v.id !== version.id);

  // Default to the previous version in the list (next index, since sorted desc)
  const idx = allVersions.findIndex(v => v.id === version.id);
  const defaultBaseId = idx >= 0 && idx < allVersions.length - 1 ? allVersions[idx + 1].id : null;

  const [compareId, setCompareId] = useState<string | null>(defaultBaseId);
  const [compareOpen, setCompareOpen] = useState(false);
  const [lines, setLines] = useState<DiffLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const compareRef = useRef<HTMLDivElement>(null);

  const baseVersion = compareId ? allVersions.find(v => v.id === compareId) || null : null;

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (compareRef.current && !compareRef.current.contains(e.target as Node)) {
        setCompareOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Fetch snapshots and compute diff
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!baseVersion) {
        setLines([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const snapshots = await getVersionSnapshots([version.id, baseVersion.id]);
        if (cancelled) return;

        const oldSnap = snapshots[baseVersion.id];
        const newSnap = snapshots[version.id];

        if (!oldSnap || !newSnap) {
          setLines([]);
        } else {
          setLines(buildDiffLines(oldSnap, newSnap));
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load snapshots');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [version.id, compareId]);

  // Comparison selector
  const selector = otherVersions.length > 0 ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Comparing with</span>
      <div ref={compareRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setCompareOpen(!compareOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '4px 10px',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          {baseVersion ? baseVersion.version : 'select version'}
          <svg width="8" height="5" viewBox="0 0 10 6" fill="none"
            style={{ transform: compareOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M1 1L5 5L9 1" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {compareOpen && (
          <div className="thin-scrollbar" style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 160,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 4,
            zIndex: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            maxHeight: 200,
            overflowY: 'auto',
          }}>
            {otherVersions.map(v => (
              <button
                key={v.id}
                onClick={() => { setCompareId(v.id); setCompareOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '6px 10px', background: v.id === compareId ? 'var(--bg-hover)' : 'transparent',
                  color: 'var(--text-primary)', border: 'none', borderRadius: 'var(--radius-sm)',
                  fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-mono)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = v.id === compareId ? 'var(--bg-hover)' : 'transparent')}
              >
                {v.version}
                <span style={{ fontFamily: 'var(--font-sans)', color: statusColors[v.status] || 'var(--text-muted)', fontSize: 11 }}>
                  {statusLabels[v.status]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  if (loading) {
    return (
      <div>
        {selector}
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 16px' }}>
          Loading changes...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {selector}
        <div style={{ color: '#f87171', textAlign: 'center', padding: '48px 16px' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return (
      <div>
        {selector}
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 16px' }}>
          {!baseVersion ? 'No previous version to compare against' : 'No changes detected'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {selector}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 8,
        background: 'var(--bg-primary)',
      }}>
        {lines.map((l, i) => {
          const c = diffColors[l.type];
          return (
            <div key={i} style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              padding: '4px 8px',
              background: c.bg,
              borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: c.fg,
                flexShrink: 0,
                lineHeight: '18px',
              }}>
                {c.prefix}
              </span>
              <span style={{
                fontSize: 12,
                color: c.fg,
                wordBreak: 'break-all',
                flex: 1,
                lineHeight: '18px',
              }}>
                {l.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
