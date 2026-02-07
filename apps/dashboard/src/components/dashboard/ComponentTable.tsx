import { useState } from 'react';

interface ComponentSummary {
  key: string;
  name: string;
  latestVersion: string;
  status: string;
  thumbnailUrl: string | null;
  updatedAt: string;
}

interface Props {
  components: ComponentSummary[];
  projectId: string;
}

type SortField = 'name' | 'status' | 'updatedAt';

const statusColors: Record<string, string> = {
  published: '#2ea043',
  draft: '#f0883e',
  in_review: '#58a6ff',
  approved: '#00d4aa',
  deprecated: '#6b7280',
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

export default function ComponentTable({ components, projectId }: Props) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...components].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
    else cmp = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    return sortAsc ? cmp : -cmp;
  });

  function handleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return '';
    return sortAsc ? ' \u2191' : ' \u2193';
  }

  if (components.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
        No components tracked yet
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
      }}>
        <thead>
          <tr>
            {(['name', 'status', 'updatedAt'] as SortField[]).map((field) => (
              <th
                key={field}
                onClick={() => handleSort(field)}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {field === 'updatedAt' ? 'Updated' : field}
                {sortIndicator(field)}
              </th>
            ))}
            <th style={{
              textAlign: 'left',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Version
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr
              key={c.key}
              onClick={() => {
                window.location.href = `/dashboard/components/${encodeURIComponent(c.key)}?project=${projectId}`;
              }}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <td style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}>
                {c.name}
              </td>
              <td style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{
                  color: statusColors[c.status] || 'var(--text-muted)',
                  fontSize: '0.8rem',
                }}>
                  {statusLabels[c.status] || c.status}
                </span>
              </td>
              <td style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}>
                {timeAgo(c.updatedAt)}
              </td>
              <td style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.8rem',
              }}>
                {c.latestVersion}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
