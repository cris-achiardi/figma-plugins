import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { diff as deepDiff } from 'deep-diff';
import type {
  Scope, VersionStatus, BumpType, AuditAction,
  ComponentVersion, AuditEntry, ExtractedComponent,
  UIMessage, CodeMessage,
} from './types';
import {
  getOrCreateProject, createDraft, submitForReview,
  approveVersion, rejectVersion, publishVersion,
  getVersionHistory, getLatestPublished, getActiveDraft,
  getVersionById, uploadThumbnail, getAuditLog,
  computeVersion,
} from './supabase';

// ── Helpers ──────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const statusColor: Record<VersionStatus, string> = {
  draft: 'var(--status-draft)',
  in_review: 'var(--status-review)',
  approved: 'var(--status-approved)',
  published: 'var(--status-published)',
};

const statusLabel: Record<VersionStatus, string> = {
  draft: 'draft',
  in_review: 'in_review',
  approved: 'approved',
  published: 'published',
};

function postToCode(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

// Build human-readable diff lines from two JSON snapshots
interface DiffLine { type: 'added' | 'changed' | 'removed'; text: string }

function buildDiffLines(oldSnap: any, newSnap: any): DiffLine[] {
  if (!oldSnap || !newSnap) return [];
  const diffs = deepDiff(oldSnap, newSnap);
  if (!diffs) return [];

  const lines: DiffLine[] = [];
  for (const d of diffs) {
    const path = (d.path || []).join('.');
    switch (d.kind) {
      case 'N':
        lines.push({ type: 'added', text: `added ${path}` });
        break;
      case 'D':
        lines.push({ type: 'removed', text: `removed ${path}` });
        break;
      case 'E':
        lines.push({ type: 'changed', text: `changed ${path}: ${JSON.stringify(d.lhs)} >> ${JSON.stringify(d.rhs)}` });
        break;
      case 'A':
        lines.push({ type: 'changed', text: `array change at ${path}[${d.index}]` });
        break;
    }
  }
  return lines.slice(0, 50); // cap at 50 lines
}

// ── Shared Styles ────────────────────────────────────

const s = {
  heading: { fontFamily: 'var(--font-heading)', fontWeight: 700 } as React.CSSProperties,
  body: { fontFamily: 'var(--font-body)', fontWeight: 'normal' } as React.CSSProperties,
  label: { fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 11 } as React.CSSProperties,
  sectionTitle: {
    fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 'normal',
  } as React.CSSProperties,
  card: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 12,
  } as React.CSSProperties,
  btnPrimary: {
    fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 500,
    background: 'var(--accent)', color: '#0A0A0A', border: 'none',
    padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
  } as React.CSSProperties,
  btnSecondary: {
    fontFamily: 'var(--font-heading)', fontSize: 12,
    background: 'none', color: 'var(--text-primary)',
    border: '1px solid var(--border)', padding: '8px 16px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  } as React.CSSProperties,
  btnGhost: {
    fontFamily: 'var(--font-heading)', fontSize: 11,
    background: 'none', color: 'var(--accent)', border: 'none',
    padding: '6px 10px', cursor: 'pointer',
  } as React.CSSProperties,
  btnDanger: {
    fontFamily: 'var(--font-heading)', fontSize: 12,
    background: 'none', color: 'var(--diff-removed)',
    border: '1px solid var(--diff-removed)', padding: '8px 16px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  } as React.CSSProperties,
};

// ── Small components ─────────────────────────────────

function Badge({ status }: { status: VersionStatus }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      border: `1px solid ${statusColor[status]}`, padding: '3px 8px',
      ...s.label, fontSize: 10, color: statusColor[status],
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: statusColor[status],
      }} />
      {statusLabel[status]}
    </span>
  );
}

function BumpBadge({ bump }: { bump: BumpType }) {
  const colors: Record<BumpType, { bg: string; fg: string }> = {
    patch: { bg: '#2A2A2A', fg: 'var(--text-secondary)' },
    minor: { bg: '#06B6D420', fg: 'var(--cyan)' },
    major: { bg: '#F59E0B20', fg: 'var(--amber)' },
  };
  const c = colors[bump];
  return (
    <span style={{
      ...s.label, fontSize: 10, background: c.bg, color: c.fg, padding: '2px 6px',
    }}>
      {bump}
    </span>
  );
}

function DiffBlock({ lines }: { lines: DiffLine[] }) {
  if (lines.length === 0) {
    return <div style={{ ...s.body, fontSize: 11, color: 'var(--text-tertiary)', padding: 8 }}>no changes detected</div>;
  }
  const colors: Record<string, { bg: string; fg: string; prefix: string }> = {
    added: { bg: '#10B98110', fg: 'var(--diff-added)', prefix: '+' },
    changed: { bg: '#F59E0B10', fg: 'var(--diff-changed)', prefix: '~' },
    removed: { bg: '#EF444410', fg: 'var(--diff-removed)', prefix: '-' },
  };
  return (
    <div style={{ border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2, padding: 8 }}>
      {lines.map((l, i) => {
        const c = colors[l.type];
        return (
          <div key={i} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 8px',
            background: c.bg,
          }}>
            <span style={{ ...s.heading, fontSize: 11, color: c.fg, flexShrink: 0 }}>{c.prefix}</span>
            <span style={{
              ...s.body, fontSize: 11, color: c.fg,
              wordBreak: 'break-all', flex: 1,
            }}>{l.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function Stepper({ status }: { status: VersionStatus }) {
  const steps: { key: VersionStatus; label: string }[] = [
    { key: 'draft', label: 'draft' },
    { key: 'in_review', label: 'review' },
    { key: 'approved', label: 'approved' },
    { key: 'published', label: 'published' },
  ];
  const idx = steps.findIndex(s => s.key === status);

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {steps.map((step, i) => {
        const isActive = i === idx;
        const isDone = i < idx;
        const dotColor = isActive ? statusColor[step.key] : isDone ? 'var(--accent)' : 'var(--border)';
        const labelColor = isActive ? statusColor[step.key] : isDone ? 'var(--accent)' : 'var(--text-tertiary)';
        const lineColor = isDone ? 'var(--accent)' : 'var(--border)';
        return (
          <React.Fragment key={step.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
              <span style={{ ...s.label, fontSize: 10, color: labelColor, fontWeight: isActive ? 700 : 'normal' }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: lineColor, margin: '0 4px', alignSelf: 'flex-start', marginTop: 4 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ProgressBar({ percent, message }: { percent: number; message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 12,
    }}>
      <div style={{ width: 200, height: 4, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
      </div>
      <span style={{ ...s.label, color: 'var(--text-secondary)' }}>{percent}%</span>
      <span style={{ ...s.body, fontSize: 11, color: 'var(--text-tertiary)' }}>{message}</span>
    </div>
  );
}

// ── Screen: Component List ───────────────────────────

function ComponentListScreen({ components, userName, fileKey, onViewDetail, onViewHistory }: {
  components: ExtractedComponent[];
  userName: string;
  fileKey: string;
  onViewDetail: (comp: ExtractedComponent) => void;
  onViewHistory: (comp: ExtractedComponent) => void;
}) {
  const [scope, setScope] = React.useState<Scope>('page');
  const [search, setSearch] = React.useState('');
  const [extracting, setExtracting] = React.useState(false);
  const [progress, setProgress] = React.useState({ percent: 0, message: '' });
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [versionMap, setVersionMap] = React.useState<Record<string, ComponentVersion | null>>({});
  const [draftMap, setDraftMap] = React.useState<Record<string, ComponentVersion | null>>({});

  // Init project on mount
  React.useEffect(() => {
    getOrCreateProject(fileKey, fileKey).then(p => setProjectId(p.id)).catch(console.error);
  }, [fileKey]);

  // Fetch version data when components change
  React.useEffect(() => {
    if (!projectId || components.length === 0) return;
    (async () => {
      const vm: Record<string, ComponentVersion | null> = {};
      const dm: Record<string, ComponentVersion | null> = {};
      for (const c of components) {
        vm[c.key] = await getLatestPublished(c.key, projectId).catch(() => null);
        dm[c.key] = await getActiveDraft(c.key, projectId).catch(() => null);
      }
      setVersionMap(vm);
      setDraftMap(dm);
    })();
  }, [projectId, components]);

  const handleExtract = () => {
    setExtracting(true);
    postToCode({ type: 'extract-components', scope });
  };

  const handleCreateDraft = async (comp: ExtractedComponent) => {
    if (!projectId) return;
    try {
      const latest = versionMap[comp.key];
      const diffLines = latest ? deepDiff(latest.snapshot, comp.snapshot) : null;

      // Upload thumbnail
      const bytes = new Uint8Array(comp.thumbnailBytes);
      const thumbPath = `${projectId}/${comp.key}/${Date.now()}.png`;
      let thumbnailUrl: string | null = null;
      try { thumbnailUrl = await uploadThumbnail(bytes, thumbPath); } catch { /* ok */ }

      const draft = await createDraft({
        projectId,
        componentKey: comp.key,
        componentName: comp.name,
        snapshot: comp.snapshot,
        propertyDefinitions: comp.propertyDefinitions,
        variablesUsed: comp.variablesUsed,
        diff: diffLines,
        createdBy: userName,
      });

      setDraftMap(prev => ({ ...prev, [comp.key]: draft }));
      onViewDetail(comp);
    } catch (err: any) {
      console.error('Create draft failed:', err);
    }
  };

  const filtered = components.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Listen to progress from code.ts
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data.pluginMessage as CodeMessage;
      if (!msg) return;
      if (msg.type === 'extraction-progress') {
        setProgress({ percent: msg.percent, message: msg.message });
      }
      if (msg.type === 'extraction-complete') {
        setExtracting(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (extracting) {
    return <ProgressBar percent={progress.percent} message={progress.message} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '10px 20px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid var(--border)', padding: '6px 10px',
        }}>
          <span style={{ ...s.body, fontSize: 11, color: 'var(--text-secondary)' }}>scope:</span>
          <select
            value={scope}
            onChange={e => setScope(e.target.value as Scope)}
            style={{
              ...s.label, background: 'none', color: 'var(--text-primary)', border: 'none',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="page">page</option>
            <option value="selection">selection</option>
          </select>
        </div>
        <button style={s.btnPrimary} onClick={handleExtract}>$ extract_all</button>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ ...s.heading, fontSize: 12, color: 'var(--text-tertiary)' }}>/</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="search components..."
          style={{
            ...s.body, fontSize: 12, background: 'none', border: 'none', color: 'var(--text-primary)',
            outline: 'none', width: '100%',
          }}
        />
      </div>

      {/* Count */}
      <div style={{ padding: '8px 20px' }}>
        <span style={{ ...s.label, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 'normal' }}>
          // found {filtered.length} components
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(comp => {
          const latest = versionMap[comp.key];
          const draft = draftMap[comp.key];
          const hasDraft = draft && draft.status !== 'published';

          return (
            <div key={comp.key} style={{ ...s.card, display: 'flex', gap: 12 }}>
              {/* Thumbnail */}
              <div style={{
                width: 64, height: 64, background: 'var(--bg-active)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {comp.thumbnailBytes.length > 0 ? (
                  <img
                    src={URL.createObjectURL(new Blob([new Uint8Array(comp.thumbnailBytes)], { type: 'image/png' }))}
                    style={{ maxWidth: 60, maxHeight: 60, objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>no thumb</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...s.heading, fontSize: 13, color: 'var(--text-primary)' }}>{comp.name}</span>
                  {hasDraft ? (
                    <Badge status={draft!.status} />
                  ) : latest ? (
                    <Badge status="published" />
                  ) : (
                    <span style={{
                      ...s.label, fontSize: 10, color: 'var(--text-tertiary)',
                      border: '1px solid var(--text-tertiary)', padding: '3px 8px',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)' }} />
                      no versions
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {hasDraft ? (
                    <span style={{ ...s.label, fontSize: 11, color: statusColor[draft!.status] }}>
                      v{draft!.version}-{draft!.status.replace('_', '')}
                    </span>
                  ) : latest ? (
                    <span style={{ ...s.label, fontSize: 11, color: 'var(--accent)' }}>v{latest.version}</span>
                  ) : null}
                  {(hasDraft || latest) && <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>·</span>}
                  <span style={{ ...s.body, fontSize: 11, color: 'var(--text-secondary)' }}>
                    {comp.publishStatus.toLowerCase().replace('_', ' ')}
                  </span>
                </div>

                <div style={{ ...s.body, fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {hasDraft
                    ? `draft by: ${draft!.created_by}`
                    : latest ? formatDate(latest.published_at || latest.created_at) : ''
                  }
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {hasDraft ? (
                    <button style={s.btnPrimary} onClick={() => onViewDetail(comp)}>view draft</button>
                  ) : (
                    <button style={s.btnSecondary} onClick={() => handleCreateDraft(comp)}>create draft</button>
                  )}
                  {latest && (
                    <button style={s.btnGhost} onClick={() => onViewHistory(comp)}>history</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Screen: Version Detail / Approval Pipeline ──────

function VersionDetailScreen({ comp, userName, projectId, onBack, onViewHistory }: {
  comp: ExtractedComponent;
  userName: string;
  projectId: string;
  onBack: () => void;
  onViewHistory: () => void;
}) {
  const [version, setVersion] = React.useState<ComponentVersion | null>(null);
  const [latest, setLatest] = React.useState<ComponentVersion | null>(null);
  const [auditLog, setAuditLog] = React.useState<AuditEntry[]>([]);
  const [reviewNote, setReviewNote] = React.useState('');
  const [bumpType, setBumpType] = React.useState<BumpType>('minor');
  const [changelogMsg, setChangelogMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [diffLines, setDiffLines] = React.useState<DiffLine[]>([]);

  // Load data
  React.useEffect(() => {
    (async () => {
      const draft = await getActiveDraft(comp.key, projectId);
      const pub = await getLatestPublished(comp.key, projectId);
      setVersion(draft);
      setLatest(pub);
      if (draft) {
        const log = await getAuditLog(draft.id);
        setAuditLog(log as AuditEntry[]);
        if (pub && draft.snapshot && pub.snapshot) {
          setDiffLines(buildDiffLines(pub.snapshot, draft.snapshot));
        } else if (draft.diff) {
          // Use stored diff
          setDiffLines((draft.diff as any[]).map(d => ({
            type: d.kind === 'N' ? 'added' : d.kind === 'D' ? 'removed' : 'changed',
            text: (d.path || []).join('.'),
          })));
        }
      }
    })();
  }, [comp.key, projectId]);

  const reload = async () => {
    const v = await getVersionById(version!.id);
    setVersion(v);
    if (v) {
      const log = await getAuditLog(v.id);
      setAuditLog(log as AuditEntry[]);
    }
  };

  const handleSubmitForReview = async () => {
    if (!version) return;
    setLoading(true);
    await submitForReview(version.id, userName);
    await reload();
    setLoading(false);
  };

  const handleApprove = async () => {
    if (!version) return;
    setLoading(true);
    await approveVersion(version.id, userName);
    await reload();
    setLoading(false);
  };

  const handleReject = async () => {
    if (!version) return;
    setLoading(true);
    await rejectVersion(version.id, userName, reviewNote || undefined);
    await reload();
    setLoading(false);
  };

  const handlePublish = async () => {
    if (!version) return;
    setLoading(true);
    const published = await publishVersion(version.id, bumpType, changelogMsg, userName);
    setVersion(published);
    const log = await getAuditLog(published.id);
    setAuditLog(log as AuditEntry[]);
    setLoading(false);
  };

  if (!version) {
    return <ProgressBar percent={50} message="Loading version..." />;
  }

  const status = version.status as VersionStatus;
  const currentVer = latest?.version || '0.0.0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
      }}>
        <button style={{ ...s.btnGhost, color: 'var(--accent)' }} onClick={onBack}>{'< back'}</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ ...s.heading, fontSize: 13, color: 'var(--text-primary)' }}>{version.component_name}</span>
          <span style={{ ...s.label, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 'normal' }}>
            v{version.version}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stepper */}
        <Stepper status={status} />

        {/* Meta */}
        <div style={{ ...s.body, fontSize: 11, color: 'var(--text-secondary)' }}>
          {status === 'draft' && `created by: ${version.created_by} · ${formatDate(version.created_at)}`}
          {status === 'in_review' && `created by: ${version.created_by} · submitted: ${formatDate(version.updated_at)}`}
          {status === 'approved' && `approved by: ${version.reviewed_by || userName} · ${formatDate(version.updated_at)}`}
          {status === 'published' && `published by: ${version.created_by} · ${formatDate(version.published_at || version.updated_at)}`}
        </div>

        {/* Thumbnails (draft/review only) */}
        {(status === 'draft' || status === 'in_review') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={s.sectionTitle}>// thumbnails</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                flex: 1, height: 80, background: 'var(--bg-active)',
                border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ ...s.label, fontSize: 10, color: 'var(--text-tertiary)' }}>v{currentVer}</span>
              </div>
              <span style={{ ...s.label, fontSize: 12, color: 'var(--text-tertiary)' }}>{'>>'}</span>
              <div style={{
                flex: 1, height: 80, background: 'var(--bg-active)',
                border: `1px solid ${statusColor[status]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ ...s.label, fontSize: 10, color: statusColor[status] }}>{statusLabel[status]}</span>
              </div>
            </div>
          </div>
        )}

        {/* Published success card */}
        {status === 'published' && (
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center', padding: 12,
            background: '#10B98115', border: '1px solid var(--accent-dim)',
          }}>
            <span style={{ color: 'var(--accent)', fontSize: 18 }}>&#10003;</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ ...s.heading, fontSize: 12, color: 'var(--accent)' }}>published</span>
              <span style={{ ...s.body, fontSize: 10, color: 'var(--text-secondary)' }}>
                v{version.version} ({version.bump_type}) · {formatDate(version.published_at || version.updated_at)} · {version.created_by}
              </span>
            </div>
          </div>
        )}

        {/* Changelog (published only) */}
        {status === 'published' && version.changelog_message && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={s.sectionTitle}>// changelog</span>
            <div style={{ border: '1px solid var(--border)', padding: 12 }}>
              <span style={{ ...s.body, fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {version.changelog_message}
              </span>
            </div>
          </div>
        )}

        {/* Diff */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={s.sectionTitle}>// changes vs v{currentVer}</span>
          <DiffBlock lines={diffLines} />
        </div>

        {/* Review section (in_review) */}
        {status === 'in_review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={s.sectionTitle}>// review note (optional)</span>
            <div style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 10,
            }}>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="review notes..."
                style={{
                  ...s.body, fontSize: 11, background: 'none', border: 'none', color: 'var(--text-primary)',
                  outline: 'none', width: '100%', minHeight: 60, resize: 'vertical', lineHeight: 1.5,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...s.btnDanger, flex: 1 }} onClick={handleReject} disabled={loading}>reject</button>
              <button style={{ ...s.btnPrimary, flex: 1 }} onClick={handleApprove} disabled={loading}>$ approve</button>
            </div>
          </div>
        )}

        {/* Publish section (approved) */}
        {status === 'approved' && (
          <div style={{
            ...s.card, display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
          }}>
            <span style={s.sectionTitle}>// publish</span>
            <span style={{ ...s.label, fontSize: 11, color: 'var(--text-primary)', fontWeight: 'normal' }}>version bump:</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['patch', 'minor', 'major'] as BumpType[]).map(bt => {
                const active = bumpType === bt;
                const newVer = computeVersion(currentVer, bt);
                return (
                  <button
                    key={bt}
                    onClick={() => setBumpType(bt)}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      padding: '8px 12px', cursor: 'pointer',
                      background: active ? 'var(--accent-dim)' : 'none',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <span style={{
                      ...s.label, fontSize: 11,
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: active ? 700 : 'normal',
                    }}>{bt}</span>
                    <span style={{
                      ...s.label, fontSize: 10,
                      color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                      fontWeight: 'normal',
                    }}>{newVer}</span>
                  </button>
                );
              })}
            </div>
            <span style={{ ...s.label, fontSize: 11, color: 'var(--text-primary)', fontWeight: 'normal' }}>changelog message:</span>
            <div style={{
              background: 'var(--bg-page)', border: '1px solid var(--border)', padding: 10,
            }}>
              <textarea
                value={changelogMsg}
                onChange={e => setChangelogMsg(e.target.value)}
                placeholder="describe what changed..."
                style={{
                  ...s.body, fontSize: 11, background: 'none', border: 'none', color: 'var(--text-primary)',
                  outline: 'none', width: '100%', minHeight: 80, resize: 'vertical', lineHeight: 1.5,
                }}
              />
            </div>
            <button
              style={{ ...s.btnPrimary, width: '100%' }}
              onClick={handlePublish}
              disabled={loading || !changelogMsg.trim()}
            >
              $ publish v{computeVersion(currentVer, bumpType)}
            </button>
          </div>
        )}

        {/* Submit button (draft) */}
        {status === 'draft' && (
          <div style={{ padding: '8px 0' }}>
            <button style={{ ...s.btnPrimary, width: '100%' }} onClick={handleSubmitForReview} disabled={loading}>
              $ submit_for_review
            </button>
          </div>
        )}

        {/* Audit trail (published) */}
        {status === 'published' && auditLog.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={s.sectionTitle}>// audit_trail</span>
            <div style={{ border: '1px solid var(--border)', padding: '8px 12px' }}>
              {auditLog.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ ...s.label, fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
                    {formatTime(entry.created_at)}
                  </span>
                  <span style={{ ...s.label, fontSize: 10, color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                    {entry.performed_by}
                  </span>
                  <span style={{
                    ...s.body, fontSize: 10,
                    color: entry.action === 'published' ? 'var(--accent)' : 'var(--text-primary)',
                  }}>
                    {entry.action.replace(/_/g, ' ')}{entry.note ? ` — ${entry.note}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Published action row */}
        {status === 'published' && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button style={s.btnSecondary} onClick={onViewHistory}>view history</button>
            <button style={s.btnSecondary} onClick={() => {
              const blob = new Blob([JSON.stringify(version.snapshot, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${version.component_name}-v${version.version}.json`;
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}>export json</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Screen: Version History ──────────────────────────

function VersionHistoryScreen({ comp, projectId, onBack, onViewDetail }: {
  comp: ExtractedComponent;
  projectId: string;
  onBack: () => void;
  onViewDetail: (v: ComponentVersion) => void;
}) {
  const [versions, setVersions] = React.useState<ComponentVersion[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const all = await getVersionHistory(comp.key, projectId);
      setVersions(all);
      setLoading(false);
    })();
  }, [comp.key, projectId]);

  if (loading) return <ProgressBar percent={50} message="Loading history..." />;

  const published = versions.filter(v => v.status === 'published');
  const pending = versions.filter(v => v.status !== 'published');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
      }}>
        <button style={{ ...s.btnGhost, color: 'var(--accent)' }} onClick={onBack}>{'< back'}</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ ...s.heading, fontSize: 13, color: 'var(--text-primary)' }}>{comp.name}</span>
          <span style={{ ...s.label, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 'normal' }}>history</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={s.sectionTitle}>// published_versions</span>

        {published.length === 0 && (
          <div style={{ ...s.body, fontSize: 11, color: 'var(--text-tertiary)', padding: 20, textAlign: 'center' }}>
            no published versions yet
          </div>
        )}

        {published.map(v => (
          <div key={v.id} style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ ...s.heading, fontSize: 13, color: 'var(--text-primary)' }}>v{v.version}</span>
                {v.bump_type && <BumpBadge bump={v.bump_type} />}
              </div>
              <span style={{ ...s.body, fontSize: 10, color: 'var(--text-tertiary)' }}>
                {formatDate(v.published_at || v.created_at)} · {v.created_by}
              </span>
            </div>

            {v.changelog_message && (
              <span style={{ ...s.body, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {v.changelog_message}
              </span>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => onViewDetail(v)}>view details</button>
              <button style={s.btnGhost} onClick={() => {
                const blob = new Blob([JSON.stringify(v.snapshot, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${v.component_name}-v${v.version}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}>export json</button>
            </div>
          </div>
        ))}

        {/* Pending drafts */}
        {pending.length > 0 && (
          <div style={{
            ...s.card, borderColor: '#6B728040',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-draft)' }} />
              <span style={{ ...s.label, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                pending: {pending.length} draft{pending.length > 1 ? 's' : ''} in progress
              </span>
            </div>
            {pending.map(v => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...s.body, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  v{v.version} ({v.status.replace('_', ' ')}) by {v.created_by}
                </span>
                <button style={s.btnPrimary} onClick={() => onViewDetail(v)}>view draft</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────

type View =
  | { screen: 'list' }
  | { screen: 'detail'; comp: ExtractedComponent }
  | { screen: 'detail-version'; version: ComponentVersion; comp: ExtractedComponent }
  | { screen: 'history'; comp: ExtractedComponent };

function App() {
  const [view, setView] = React.useState<View>({ screen: 'list' });
  const [userName, setUserName] = React.useState('');
  const [fileKey, setFileKey] = React.useState('');
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [components, setComponents] = React.useState<ExtractedComponent[]>([]);

  // Listen to code.ts messages
  React.useEffect(() => {
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage as CodeMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'init':
          setUserName(msg.userName);
          setFileKey(msg.fileKey);
          getOrCreateProject(msg.fileKey, msg.fileKey)
            .then(p => setProjectId(p.id))
            .catch(console.error);
          break;
        case 'extraction-complete':
          setComponents(msg.components);
          break;
        case 'error':
          console.error('Plugin error:', msg.message);
          break;
      }
    };
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header (only on list screen) */}
      {view.screen === 'list' && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ ...s.heading, fontSize: 16, color: 'var(--accent)' }}>{'>'}</span>
            <span style={{ ...s.heading, fontSize: 14, color: 'var(--text-primary)' }}>component_changelog</span>
          </div>
          <span style={{ ...s.label, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 'normal' }}>v0.1</span>
        </div>
      )}

      {/* Screens */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view.screen === 'list' && (
          <ComponentListScreen
            components={components}
            userName={userName}
            fileKey={fileKey}
            onViewDetail={(comp) => setView({ screen: 'detail', comp })}
            onViewHistory={(comp) => setView({ screen: 'history', comp })}
          />
        )}

        {view.screen === 'detail' && projectId && (
          <VersionDetailScreen
            comp={view.comp}
            userName={userName}
            projectId={projectId}
            onBack={() => setView({ screen: 'list' })}
            onViewHistory={() => setView({ screen: 'history', comp: view.comp })}
          />
        )}

        {view.screen === 'detail-version' && projectId && (
          <VersionDetailScreen
            comp={view.comp}
            userName={userName}
            projectId={projectId}
            onBack={() => setView({ screen: 'history', comp: view.comp })}
            onViewHistory={() => setView({ screen: 'history', comp: view.comp })}
          />
        )}

        {view.screen === 'history' && projectId && (
          <VersionHistoryScreen
            comp={view.comp}
            projectId={projectId}
            onBack={() => setView({ screen: 'list' })}
            onViewDetail={(v) => setView({ screen: 'detail-version', version: v, comp: view.comp })}
          />
        )}
      </div>
    </div>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
