import { useState } from 'react';

interface ActivityEntry {
  id: string;
  action: string;
  performedBy: string;
  performerPhotoUrl: string | null;
  note: string | null;
  createdAt: string;
  componentName: string;
  version: string;
}

interface Props {
  entries: ActivityEntry[];
}

const PAGE_SIZE = 10;

const actionConfig: Record<string, { icon: string; label: string; color: string }> = {
  created: { icon: '+', label: 'draft created', color: '#fbbf24' },
  submitted_for_review: { icon: '›', label: 'submitted for review', color: '#60a5fa' },
  approved: { icon: '✓', label: 'approved', color: '#4ade80' },
  published: { icon: '★', label: 'published', color: '#4ade80' },
  rejected: { icon: '✗', label: 'rejected', color: '#f87171' },
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

export default function ActivityList({ entries }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (entries.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 16px' }}>
        No activity yet
      </div>
    );
  }

  const shown = entries.slice(0, visible);
  const hasMore = visible < entries.length;

  return (
    <div>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        {shown.map((entry) => {
          const config = actionConfig[entry.action] || { icon: '•', label: entry.action, color: 'var(--text-muted)' };
          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
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
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 6, fontSize: 14 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {entry.componentName}
                </span>
                {entry.version && (
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    {entry.version}
                  </span>
                )}
                <span style={{ color: 'var(--text-secondary)' }}>
                  {config.label}
                </span>
                {entry.note && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, width: '100%' }}>
                    {entry.note}
                  </span>
                )}
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {timeAgo(entry.createdAt)} by {entry.performedBy}
                </span>
                {entry.performerPhotoUrl ? (
                  <img
                    src={entry.performerPhotoUrl}
                    alt={entry.performedBy}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: '1px solid var(--border)',
                    }}
                  />
                ) : (
                  <span style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}>
                    {entry.performedBy.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setVisible(v => v + PAGE_SIZE)}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
