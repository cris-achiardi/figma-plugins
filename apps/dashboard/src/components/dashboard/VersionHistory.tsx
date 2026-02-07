import { useState } from 'react';
import VersionDetailModal from './VersionDetailModal';

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
  component_version_id: string;
  action: string;
  performed_by: string;
  note: string | null;
  created_at: string;
}

interface Props {
  versions: VersionSlim[];
  auditLogs: Record<string, AuditEntry[]>;
}

// ----- Constants -----

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

// ----- Component -----

export default function VersionHistory({ versions, auditLogs }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedVersion = selectedId ? versions.find(v => v.id === selectedId) : null;

  if (versions.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 16px' }}>
        No versions recorded
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {versions.map(v => (
          <div
            key={v.id}
            onClick={() => setSelectedId(v.id)}
            style={{
              display: 'flex',
              gap: 16,
              padding: 16,
              borderBottom: '1px solid var(--border)',
              alignItems: 'flex-start',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ flexShrink: 0, minWidth: 80, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {v.version}
              </span>
              {v.bump_type && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {v.bump_type}
                </span>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                {v.changelog_message || 'No message'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span
                  className={`status-pill status-pill--${v.status}`}
                  style={{
                    display: 'inline-block',
                    fontSize: 12,
                    padding: '2px 10px',
                    borderRadius: 9999,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    color: statusColors[v.status] || 'var(--text-muted)',
                    background: `${statusColors[v.status] || 'var(--text-muted)'}1a`,
                  }}
                >
                  {statusLabels[v.status] || v.status}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {timeAgo(v.updated_at)}
                </span>
                {v.created_by && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    by {v.created_by}
                  </span>
                )}
              </div>
            </div>
            {/* Arrow indicator */}
            <span style={{ color: 'var(--text-muted)', fontSize: 16, flexShrink: 0, marginTop: 2 }}>
              ›
            </span>
          </div>
        ))}
      </div>

      {selectedVersion && (
        <VersionDetailModal
          version={selectedVersion}
          auditLog={auditLogs[selectedVersion.id] || []}
          allVersions={versions}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
