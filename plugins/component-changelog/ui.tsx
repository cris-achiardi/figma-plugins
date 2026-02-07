import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { diff as deepDiff } from 'deep-diff';
import type {
  VersionStatus, BumpType,
  ComponentVersion, AuditEntry, ExtractedComponent, LibraryComponent, ComponentGroup,
  LocalComponentGroup,
  UIMessage, CodeMessage,
} from './types';
import {
  supabase,
  getOrCreateProject, createDraft, deleteDraft, submitForReview,
  approveVersion, rejectVersion, publishVersion,
  getVersionHistory, getLatestPublished, getActiveDraft,
  getVersionById, uploadThumbnail, getAuditLog,
  computeVersion, getProjectVersionMaps,
} from './supabase';
import { getMe, getFileComponents, getLibraryInfo } from './figma-api';

// ── Constants ────────────────────────────────────────

const SUPABASE_URL = 'https://nwweqcjiklzmlmvbfjkt.supabase.co';
const FIGMA_CLIENT_ID = 'ToE4onWa5EXpY13cDUgd5L';
const OAUTH_CALLBACK_URL = `${SUPABASE_URL}/functions/v1/figma-oauth-callback`;

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
  deprecated: 'var(--text-tertiary)',
};

const statusLabel: Record<VersionStatus, string> = {
  draft: 'draft',
  in_review: 'in_review',
  approved: 'approved',
  published: 'published',
  deprecated: 'deprecated',
};

function postToCode(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

// Extract file key from a Figma URL or raw key
function parseFileKey(input: string): string {
  const trimmed = input.trim();
  // Match figma.com/design/KEY/... or figma.com/file/KEY/...
  const match = trimmed.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  // Already a raw key
  return trimmed;
}

// Build human-readable diff lines from two JSON snapshots
interface DiffLine { type: 'added' | 'changed' | 'removed'; text: string }

// Noise fields to skip in diff output
const SKIP_FIELDS = new Set([
  'id', 'key', 'transitionNodeID', 'prototypeStartNodeID',
  'flowStartingPoints', 'prototypeDevice', 'absoluteBoundingBox',
  'absoluteRenderBounds', 'relativeTransform', 'size',
]);

// Friendly labels for Figma properties
const PROP_NAMES: Record<string, string> = {
  paddingLeft: 'padding-left', paddingRight: 'padding-right',
  paddingTop: 'padding-top', paddingBottom: 'padding-bottom',
  itemSpacing: 'item spacing', counterAxisSpacing: 'cross-axis spacing',
  cornerRadius: 'corner radius', topLeftRadius: 'top-left radius',
  topRightRadius: 'top-right radius', bottomLeftRadius: 'bottom-left radius',
  bottomRightRadius: 'bottom-right radius',
  layoutMode: 'layout mode', primaryAxisSizingMode: 'primary axis sizing',
  counterAxisSizingMode: 'counter axis sizing',
  primaryAxisAlignItems: 'main axis align', counterAxisAlignItems: 'cross axis align',
  opacity: 'opacity', visible: 'visibility', blendMode: 'blend mode',
  clipsContent: 'clip content', characters: 'text content',
  fontSize: 'font size', fontFamily: 'font family', fontWeight: 'font weight',
  textAlignHorizontal: 'text align', lineHeightPx: 'line height',
  letterSpacing: 'letter spacing', strokeWeight: 'stroke weight',
  strokeAlign: 'stroke alignment', componentPropertyDefinitions: 'component properties',
};

function formatColor(c: any): string {
  if (!c || typeof c !== 'object') return String(c);
  const r = Math.round((c.r ?? 0) * 255);
  const g = Math.round((c.g ?? 0) * 255);
  const b = Math.round((c.b ?? 0) * 255);
  const a = c.a ?? 1;
  if (a < 1) return `rgba(${r},${g},${b},${a.toFixed(2)})`;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function resolveAtPath(obj: any, path: (string | number)[]): any {
  let cur = obj;
  for (const seg of path) { if (cur == null) return undefined; cur = cur[seg]; }
  return cur;
}

function findNodeName(obj: any, path: (string | number)[]): string {
  let cur = obj, name = '';
  for (const seg of path) {
    if (cur == null) break;
    cur = cur[seg];
    if (cur?.name) name = cur.name;
  }
  return name;
}

function prettyProp(key: string): string {
  return PROP_NAMES[key] || key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
}

function prettyVal(v: any): string {
  if (v == null) return 'none';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.length > 50 ? v.slice(0, 47) + '...' : v;
  if (typeof v === 'object') {
    if ('r' in v && 'g' in v && 'b' in v) return formatColor(v);
    if ('type' in v) return String(v.type);
    const s = JSON.stringify(v);
    return s.length > 50 ? s.slice(0, 47) + '...' : s;
  }
  return String(v);
}

function buildDiffLines(oldSnap: any, newSnap: any): DiffLine[] {
  if (!oldSnap || !newSnap) return [];
  const diffs = deepDiff(oldSnap, newSnap);
  if (!diffs) return [];

  const lines: DiffLine[] = [];
  const seen = new Set<string>();
  const colorPaths = new Set<string>();

  for (const d of diffs) {
    const path: (string | number)[] = d.path || [];
    if (path.length === 0) continue;

    // Skip noise fields
    if (path.some(seg => typeof seg === 'string' && SKIP_FIELDS.has(seg))) continue;

    // Group RGBA components into single color change
    const last = path[path.length - 1];
    if (typeof last === 'string' && ['r', 'g', 'b', 'a'].includes(last)) {
      const cPath = path.slice(0, -1);
      const cKey = cPath.join('.');
      if (colorPaths.has(cKey)) continue;
      colorPaths.add(cKey);
      const oldC = resolveAtPath(oldSnap, cPath);
      const newC = resolveAtPath(newSnap, cPath);
      const node = findNodeName(oldSnap, cPath) || findNodeName(newSnap, cPath);
      const ctx = cPath.find(s => typeof s === 'string' && ['strokes', 'effects'].includes(s));
      const label = ctx === 'strokes' ? 'stroke color' : ctx === 'effects' ? 'effect color' : 'fill color';
      const pre = node ? `${node}: ` : '';
      const text = `${pre}${label}: ${formatColor(oldC)} → ${formatColor(newC)}`;
      if (!seen.has(text)) { seen.add(text); lines.push({ type: 'changed', text }); }
      continue;
    }

    // Split path into node context + property
    let nodeParts: (string | number)[] = [];
    let propParts: string[] = [];
    const knownProps = new Set([...Object.keys(PROP_NAMES), 'fills', 'strokes', 'effects', 'style', 'children']);
    for (let i = 0; i < path.length; i++) {
      if (typeof path[i] === 'string' && knownProps.has(path[i] as string)) {
        nodeParts = path.slice(0, i);
        propParts = path.slice(i).map(String);
        break;
      }
    }
    if (propParts.length === 0) {
      nodeParts = path.slice(0, -1);
      propParts = [String(path[path.length - 1])];
    }

    const nodeName = findNodeName(oldSnap, nodeParts) || findNodeName(newSnap, nodeParts);
    const pre = nodeName ? `${nodeName}: ` : '';
    const prop = prettyProp(propParts[0]) + (propParts.length > 1 ? '.' + propParts.slice(1).join('.') : '');

    let text = '';
    let type: DiffLine['type'] = 'changed';

    switch (d.kind) {
      case 'N': {
        type = 'added';
        const v = d.rhs;
        text = (v?.name && v?.type) ? `added ${v.type}: "${v.name}"` : `${pre}added ${prop}`;
        break;
      }
      case 'D': {
        type = 'removed';
        const v = d.lhs;
        text = (v?.name && v?.type) ? `removed ${v.type}: "${v.name}"` : `${pre}removed ${prop}`;
        break;
      }
      case 'E':
        type = 'changed';
        text = `${pre}${prop}: ${prettyVal(d.lhs)} → ${prettyVal(d.rhs)}`;
        break;
      case 'A':
        if (d.item?.kind === 'N') {
          type = 'added';
          const name = d.item?.rhs?.name;
          text = name ? `${pre}added ${propParts[0]}: "${name}"` : `${pre}added ${prop}[${d.index}]`;
        } else if (d.item?.kind === 'D') {
          type = 'removed';
          const name = d.item?.lhs?.name;
          text = name ? `${pre}removed ${propParts[0]}: "${name}"` : `${pre}removed ${prop}[${d.index}]`;
        } else {
          type = 'changed';
          text = `${pre}changed ${prop}[${d.index}]`;
        }
        break;
    }

    if (text && !seen.has(text)) { seen.add(text); lines.push({ type, text }); }
  }

  // Sort: added first, then changed, then removed
  const order = { added: 0, changed: 1, removed: 2 };
  lines.sort((a, b) => order[a.type] - order[b.type]);
  return lines.slice(0, 80);
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
  input: {
    fontFamily: 'var(--font-body)', fontSize: 12, background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', color: 'var(--text-primary)',
    padding: '10px 12px', outline: 'none', width: '100%',
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

// ── Screen: Auth ─────────────────────────────────────

function AuthScreen({ onAuthenticated }: {
  onAuthenticated: (token: string, userName: string) => void;
}) {
  const [error, setError] = React.useState<string | null>(null);

  const handleConnect = () => {
    setError(null);
    const state = Math.random().toString(36).slice(2);
    const authUrl = `https://www.figma.com/oauth?client_id=${FIGMA_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_CALLBACK_URL)}&scope=current_user:read,file_content:read,file_metadata:read,file_versions:read,file_comments:read,file_comments:write,file_dev_resources:read,file_dev_resources:write,library_assets:read,library_content:read,team_library_content:read,projects:read,webhooks:read,webhooks:write&state=${state}&response_type=code`;

    window.open(authUrl, 'figma-oauth', 'width=500,height=700');

    // Poll oauth_sessions table for the result
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes at 2s intervals
    const poll = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(poll);
        setError('Authentication timed out. Please try again.');
        return;
      }
      try {
        const { data } = await supabase
          .from('oauth_sessions')
          .select('access_token, figma_user_id, user_name')
          .eq('state', state)
          .single();

        if (data) {
          clearInterval(poll);
          // Clean up the session row
          await supabase.from('oauth_sessions').delete().eq('state', state);
          onAuthenticated(data.access_token, data.user_name || 'unknown');
        }
      } catch {
        // Not found yet, keep polling
      }
    }, 2000);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 24, padding: 40,
    }}>
      <span style={{ ...s.heading, fontSize: 16, color: 'var(--accent)' }}>{'>'}</span>
      <span style={{ ...s.heading, fontSize: 14, color: 'var(--text-primary)' }}>component_changelog</span>
      <span style={{ ...s.body, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
        connect your Figma account to track<br />
        component versions across libraries
      </span>

      <button style={{ ...s.btnPrimary, padding: '12px 32px' }} onClick={handleConnect}>
        $ connect_with_figma
      </button>

      {error && (
        <span style={{ ...s.body, fontSize: 11, color: 'var(--diff-removed)', textAlign: 'center' }}>
          {error}
        </span>
      )}

      <span style={{ ...s.body, fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
        grants read-only access to your files
      </span>
    </div>
  );
}

// ── Screen: Library Setup ────────────────────────────

function LibrarySetupScreen({ token, onLibraryConnected, onDisconnect }: {
  token: string;
  onLibraryConnected: (fileKey: string, libraryName: string) => void;
  onDisconnect: () => void;
}) {
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleConnect = async () => {
    const fileKey = parseFileKey(input);
    if (!fileKey) {
      setError('Enter a valid Figma file URL or key.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const info = await getLibraryInfo(fileKey, token);
      onLibraryConnected(fileKey, info.name);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to library.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ ...s.heading, fontSize: 16, color: 'var(--accent)' }}>{'>'}</span>
          <span style={{ ...s.heading, fontSize: 14, color: 'var(--text-primary)' }}>connect_library</span>
        </div>
        <button style={{ ...s.btnGhost, fontSize: 10, color: 'var(--text-tertiary)' }} onClick={onDisconnect}>
          disconnect
        </button>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 20, padding: 40,
      }}>
        <span style={{ ...s.body, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
          paste a Figma library file URL or key<br />
          to connect and track its components
        </span>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            placeholder="figma.com/design/abc123... or file key"
            style={s.input}
          />

          <button
            style={{ ...s.btnPrimary, width: '100%', opacity: loading || !input.trim() ? 0.5 : 1 }}
            onClick={handleConnect}
            disabled={loading || !input.trim()}
          >
            {loading ? 'connecting...' : '$ connect_library'}
          </button>
        </div>

        {error && (
          <span style={{ ...s.body, fontSize: 11, color: 'var(--diff-removed)', textAlign: 'center' }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Screen: Library Components ───────────────────────

function LibraryComponentsScreen({
  token, fileKey, libraryName, userName, projectId, visible,
  onViewDetail, onViewHistory, onChangeLibrary, onDisconnect,
}: {
  token: string;
  fileKey: string;
  libraryName: string;
  userName: string;
  projectId: string;
  visible: boolean;
  onViewDetail: (comp: ExtractedComponent) => void;
  onViewHistory: (comp: ExtractedComponent) => void;
  onChangeLibrary: () => void;
  onDisconnect: () => void;
}) {
  const [localGroups, setLocalGroups] = React.useState<LocalComponentGroup[]>([]);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [extracting, setExtracting] = React.useState(false);
  const [progress, setProgress] = React.useState({ percent: 0, message: '' });
  const [extracted, setExtracted] = React.useState<ExtractedComponent[]>([]);
  const [creatingDraft, setCreatingDraft] = React.useState<string | null>(null);
  const [versionMap, setVersionMap] = React.useState<Record<string, ComponentVersion | null>>({});
  const [draftMap, setDraftMap] = React.useState<Record<string, ComponentVersion | null>>({});

  // Scan local components via Plugin API
  React.useEffect(() => {
    setLoading(true);
    postToCode({ type: 'scan-local-components' });
  }, [fileKey]);

  // Listen for local-components message from code.ts
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data.pluginMessage as CodeMessage;
      if (!msg) return;
      if (msg.type === 'local-components') {
        setLocalGroups(msg.groups);
        // Select all by default (use the group key = component set key or standalone key)
        setSelected(new Set(msg.groups.map(g => g.key)));
        setLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Fetch all version data in one batch query
  const refreshVersionMaps = React.useCallback(async () => {
    if (!projectId) return;
    try {
      const { versionMap: vm, draftMap: dm } = await getProjectVersionMaps(projectId);
      setVersionMap(vm);
      setDraftMap(dm);
    } catch (e) {
      console.error('Failed to load version data:', e);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (localGroups.length > 0) refreshVersionMaps();
  }, [localGroups, refreshVersionMaps]);

  React.useEffect(() => {
    if (extracted.length > 0) refreshVersionMaps();
  }, [extracted, refreshVersionMaps]);

  // Refresh version data when screen becomes visible (e.g. back from detail)
  React.useEffect(() => {
    if (visible && (localGroups.length > 0 || extracted.length > 0)) {
      refreshVersionMaps();
    }
  }, [visible]);

  // Listen for extraction messages from code.ts
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data.pluginMessage as CodeMessage;
      if (!msg) return;
      if (msg.type === 'extraction-progress') {
        setProgress({ percent: msg.percent, message: msg.message });
      }
      if (msg.type === 'extraction-complete') {
        setExtracting(false);
        setExtracted(msg.components);
      }
      if (msg.type === 'error') {
        setExtracting(false);
        setError(msg.message);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    const allKeys = localGroups.map(g => g.key);
    const allSelected = allKeys.every(k => selected.has(k));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allKeys));
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExtract = () => {
    const nodeIds = localGroups
      .filter(g => selected.has(g.key))
      .map(g => g.nodeId);
    if (nodeIds.length === 0) return;
    setExtracting(true);
    setError(null);
    postToCode({ type: 'extract-selected', nodeIds });
  };

  // Fresh-extract a component, then create a draft with the new snapshot
  const handleCreateDraft = async (comp: ExtractedComponent) => {
    if (!projectId) return;
    setCreatingDraft(comp.key);
    try {
      // Re-extract fresh snapshot from Figma (picks up any changes since last extraction)
      const fresh = await new Promise<ExtractedComponent>((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          const msg = e.data.pluginMessage as CodeMessage;
          if (!msg) return;
          if (msg.type === 'extraction-complete' && msg.components.length > 0) {
            window.removeEventListener('message', handler);
            resolve(msg.components[0]);
          }
          if (msg.type === 'error') {
            window.removeEventListener('message', handler);
            reject(new Error(msg.message));
          }
        };
        window.addEventListener('message', handler);
        postToCode({ type: 'extract-single', nodeId: comp.nodeId });
      });

      // Update the extracted list with fresh data
      setExtracted(prev => prev.map(c => c.key === fresh.key ? fresh : c));

      // Diff against latest published
      const latest = await getLatestPublished(fresh.key, projectId);
      const diffResult = latest ? deepDiff(latest.snapshot, fresh.snapshot) : null;

      const bytes = new Uint8Array(fresh.thumbnailBytes);
      const thumbPath = `${projectId}/${fresh.key}/${Date.now()}.png`;
      try { await uploadThumbnail(bytes, thumbPath); } catch { /* ok */ }

      await createDraft({
        projectId,
        componentKey: fresh.key,
        componentName: fresh.name,
        snapshot: fresh.snapshot,
        propertyDefinitions: fresh.propertyDefinitions,
        variablesUsed: fresh.variablesUsed,
        diff: diffResult,
        createdBy: userName,
      });

      await refreshVersionMaps();
      onViewDetail(fresh);
    } catch (err: any) {
      console.error('Create draft failed:', err);
    } finally {
      setCreatingDraft(null);
    }
  };

  if (loading) return <ProgressBar percent={30} message="Loading library components..." />;
  if (extracting) return <ProgressBar percent={progress.percent} message={progress.message} />;

  const hasExtracted = extracted.length > 0;

  const searchLower = search.toLowerCase();
  const filteredGroups = localGroups.filter(g => {
    if (!search) return true;
    if (g.name.toLowerCase().includes(searchLower)) return true;
    return g.variants.some(v => v.name.toLowerCase().includes(searchLower));
  });

  const totalVariants = filteredGroups.reduce((sum, g) => sum + g.variantCount, 0);

  const filteredExtracted = hasExtracted
    ? extracted.filter(c => !search || c.name.toLowerCase().includes(searchLower))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ ...s.heading, fontSize: 16, color: 'var(--accent)' }}>{'>'}</span>
          <span style={{ ...s.heading, fontSize: 13, color: 'var(--text-primary)' }}>{libraryName}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ ...s.body, fontSize: 10, color: 'var(--text-tertiary)' }}>{userName}</span>
          <button style={{ ...s.btnGhost, fontSize: 10, color: 'var(--text-tertiary)', padding: '4px 6px' }} onClick={onChangeLibrary}>
            switch
          </button>
          <button style={{ ...s.btnGhost, fontSize: 10, color: 'var(--diff-removed)', padding: '4px 6px' }} onClick={onDisconnect}>
            logout
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 20px', background: '#EF444415', borderBottom: '1px solid var(--diff-removed)',
          ...s.body, fontSize: 11, color: 'var(--diff-removed)',
        }}>
          {error}
        </div>
      )}

      {/* Toolbar */}
      {!hasExtracted && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '8px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ ...s.label, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 'normal' }}>
            // {filteredGroups.length} components ({totalVariants} variants)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...s.btnGhost, fontSize: 10 }} onClick={toggleAll}>
              {localGroups.every(g => selected.has(g.key)) ? 'deselect all' : 'select all'}
            </button>
            <button
              style={{ ...s.btnPrimary, opacity: selected.size === 0 ? 0.4 : 1 }}
              onClick={handleExtract}
              disabled={selected.size === 0}
            >
              $ extract ({selected.size})
            </button>
          </div>
        </div>
      )}

      {hasExtracted && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '8px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ ...s.label, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 'normal' }}>
            // extracted {filteredExtracted.length} components
          </span>
          <button style={{ ...s.btnGhost, fontSize: 10 }} onClick={() => setExtracted([])}>
            re-scan
          </button>
        </div>
      )}

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

      {/* Library component list (pre-extraction) */}
      {!hasExtracted && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
          {filteredGroups.map(group => {
            const isExpanded = expanded.has(group.nodeId);
            const hasVariants = group.variantCount > 1;
            const isSelected = selected.has(group.key);
            const draft = draftMap[group.key];
            const latest = versionMap[group.key];
            const hasDraft = draft && draft.status !== 'published';

            // Create thumbnail blob URL
            const thumbSrc = group.thumbnailBytes.length > 0
              ? URL.createObjectURL(new Blob([new Uint8Array(group.thumbnailBytes)], { type: 'image/png' }))
              : null;

            return (
              <div key={group.nodeId}>
                {/* Group row */}
                <div
                  style={{
                    ...s.card, display: 'flex', gap: 10, alignItems: 'center',
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    padding: '10px 12px',
                  }}
                >
                  {/* Expand arrow */}
                  <div
                    onClick={(e) => { e.stopPropagation(); if (hasVariants) toggleExpand(group.nodeId); }}
                    style={{
                      width: 14, flexShrink: 0, textAlign: 'center',
                      cursor: hasVariants ? 'pointer' : 'default',
                      color: 'var(--text-tertiary)', fontSize: 10,
                      userSelect: 'none',
                    }}
                  >
                    {hasVariants ? (isExpanded ? '\u25BC' : '\u25B6') : ''}
                  </div>

                  {/* Checkbox */}
                  <div
                    onClick={(e) => { e.stopPropagation(); toggleSelect(group.key); }}
                    style={{
                      width: 16, height: 16, flexShrink: 0,
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--accent)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {isSelected && <span style={{ color: '#0A0A0A', fontSize: 11, fontWeight: 700 }}>&#10003;</span>}
                  </div>

                  {/* Thumbnail */}
                  {thumbSrc && (
                    <div style={{
                      width: 36, height: 36, background: 'var(--bg-active)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      <img src={thumbSrc} style={{ maxWidth: 32, maxHeight: 32, objectFit: 'contain' }} />
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ ...s.heading, fontSize: 12, color: 'var(--text-primary)' }}>{group.name}</span>
                      {hasDraft ? (
                        <Badge status={draft!.status} />
                      ) : latest ? (
                        <span style={{ ...s.label, fontSize: 10, color: 'var(--accent)', fontWeight: 'normal' }}>v{latest.version}</span>
                      ) : null}
                    </div>
                    {hasVariants && (
                      <span style={{ ...s.body, fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {group.variantCount} variants
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded variants */}
                {isExpanded && hasVariants && (
                  <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                    {group.variants.map(variant => (
                      <div
                        key={variant.nodeId}
                        style={{
                          display: 'flex', gap: 10, alignItems: 'center',
                          padding: '6px 12px',
                          background: 'var(--bg-active)', border: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ ...s.body, fontSize: 11, color: 'var(--text-secondary)' }}>{variant.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Extracted list (post-extraction) */}
      {hasExtracted && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
          {filteredExtracted.map(comp => {
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
                <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                  {/* Left column: name, date, history */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3 }}>
                    <span style={{ ...s.heading, fontSize: 13, color: 'var(--text-primary)' }}>{comp.name}</span>
                    {latest?.published_at && !hasDraft && (
                      <span style={{ ...s.label, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        published {formatDate(latest.published_at)}
                      </span>
                    )}
                    {latest && (
                      <button
                        style={{ ...s.btnGhost, padding: 0, fontSize: 10, justifyContent: 'flex-start' }}
                        onClick={() => onViewHistory(comp)}
                      >history</button>
                    )}
                  </div>
                  {/* Right column: version + action */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}>
                    {hasDraft ? (
                      <span style={{ ...s.label, fontSize: 11, color: statusColor[draft!.status] }}>draft</span>
                    ) : latest ? (
                      <span style={{ ...s.label, fontSize: 11, color: 'var(--accent)' }}>v{latest.version}</span>
                    ) : (
                      <span style={{ ...s.label, fontSize: 11, color: 'var(--text-tertiary)' }}>no version</span>
                    )}
                    {hasDraft ? (
                      <button style={s.btnPrimary} onClick={() => onViewDetail(comp)}>view draft</button>
                    ) : (
                      <button
                        style={{ ...s.btnSecondary, opacity: creatingDraft === comp.key ? 0.5 : 1 }}
                        onClick={() => handleCreateDraft(comp)}
                        disabled={creatingDraft !== null}
                      >
                        {creatingDraft === comp.key ? 'creating...' : 'create draft'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Screen: Version Detail / Approval Pipeline ──────

function VersionDetailScreen({ comp, userName, projectId, versionId, onBack, onViewHistory }: {
  comp: ExtractedComponent;
  userName: string;
  projectId: string;
  versionId?: string;
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
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = React.useState(true);
  const [reextracting, setReextracting] = React.useState(false);

  React.useEffect(() => {
    setLoadingDiff(true);
    (async () => {
      try {
        // Load version + published snapshot (both include full snapshot via select *)
        const target = versionId
          ? await getVersionById(versionId)
          : await getActiveDraft(comp.key, projectId);
        const pub = await getLatestPublished(comp.key, projectId);
        setVersion(target);
        setLatest(pub);
        if (target) {
          const log = await getAuditLog(target.id);
          setAuditLog(log as AuditEntry[]);

          // Auto-compute diff between published and draft snapshots
          const diffBase = (pub && pub.id !== target.id) ? pub : null;
          if (diffBase?.snapshot && target.snapshot) {
            const lines = buildDiffLines(diffBase.snapshot, target.snapshot);
            if (lines.length > 0) {
              setDiffLines(lines);
            } else {
              // Fallback: raw diffs if human-readable filtering removed everything
              const rawDiffs = deepDiff(diffBase.snapshot, target.snapshot);
              if (rawDiffs && rawDiffs.length > 0) {
                setDiffLines(rawDiffs.slice(0, 60).map((d: any) => ({
                  type: d.kind === 'N' ? 'added' as const : d.kind === 'D' ? 'removed' as const : 'changed' as const,
                  text: (d.path || []).join('.') + (d.kind === 'E' ? `: ${JSON.stringify(d.lhs)} → ${JSON.stringify(d.rhs)}` : ''),
                })));
              }
            }
          }
        } else {
          setErrorMsg('No active draft found for this component.');
        }
      } catch (err: any) {
        setErrorMsg(`Failed to load version: ${err.message || err}`);
      } finally {
        setLoadingDiff(false);
      }
    })();
  }, [comp.key, projectId, versionId]);

  const reload = async () => {
    const v = await getVersionById(version!.id);
    setVersion(v);
    if (v) {
      const log = await getAuditLog(v.id);
      setAuditLog(log as AuditEntry[]);
    }
  };

  const handleDiscard = async () => {
    if (!version) return;
    setLoading(true);
    try {
      await deleteDraft(version.id);
      onBack();
    } catch (err: any) {
      setErrorMsg(`Failed to discard: ${err.message || err}`);
      setLoading(false);
    }
  };

  const handleReextract = async () => {
    if (!version) return;
    setReextracting(true);
    setErrorMsg(null);
    try {
      // Fresh-extract from Figma
      const fresh = await new Promise<ExtractedComponent>((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          const msg = e.data.pluginMessage as CodeMessage;
          if (!msg) return;
          if (msg.type === 'extraction-complete' && msg.components.length > 0) {
            window.removeEventListener('message', handler);
            resolve(msg.components[0]);
          }
          if (msg.type === 'error') {
            window.removeEventListener('message', handler);
            reject(new Error(msg.message));
          }
        };
        window.addEventListener('message', handler);
        postToCode({ type: 'extract-single', nodeId: comp.nodeId });
      });

      // Diff against latest published
      const pub = await getLatestPublished(comp.key, projectId);
      const diffResult = pub ? deepDiff(pub.snapshot, fresh.snapshot) : null;

      // Upload new thumbnail
      const bytes = new Uint8Array(fresh.thumbnailBytes);
      const thumbPath = `${projectId}/${fresh.key}/${Date.now()}.png`;
      let thumbUrl: string | undefined;
      try { thumbUrl = await uploadThumbnail(bytes, thumbPath); } catch { /* ok */ }

      // Update the draft in Supabase
      await createDraft({
        projectId,
        componentKey: fresh.key,
        componentName: fresh.name,
        snapshot: fresh.snapshot,
        propertyDefinitions: fresh.propertyDefinitions,
        variablesUsed: fresh.variablesUsed,
        diff: diffResult,
        createdBy: userName,
      });

      // Reload the version detail
      await reload();

      // Re-compute diff display
      setLatest(pub);
      if (pub?.snapshot && fresh.snapshot) {
        const lines = buildDiffLines(pub.snapshot, fresh.snapshot);
        if (lines.length > 0) {
          setDiffLines(lines);
        } else {
          const rawDiffs = deepDiff(pub.snapshot, fresh.snapshot);
          if (rawDiffs && rawDiffs.length > 0) {
            setDiffLines(rawDiffs.slice(0, 60).map((d: any) => ({
              type: d.kind === 'N' ? 'added' as const : d.kind === 'D' ? 'removed' as const : 'changed' as const,
              text: (d.path || []).join('.') + (d.kind === 'E' ? `: ${JSON.stringify(d.lhs)} → ${JSON.stringify(d.rhs)}` : ''),
            })));
          } else {
            setDiffLines([]);
          }
        }
      } else {
        setDiffLines([]);
      }
    } catch (err: any) {
      setErrorMsg(`Re-extract failed: ${err.message || err}`);
    } finally {
      setReextracting(false);
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
    if (errorMsg) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <button style={{ ...s.btnGhost, color: 'var(--accent)' }} onClick={onBack}>{'< back'}</button>
          </div>
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: 40,
          }}>
            <span style={{ ...s.body, fontSize: 11, color: 'var(--diff-removed)' }}>{errorMsg}</span>
          </div>
        </div>
      );
    }
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
        <Stepper status={status} />

        {errorMsg && (
          <div style={{
            padding: '8px 12px', background: '#EF444415', border: '1px solid var(--diff-removed)',
            ...s.body, fontSize: 11, color: 'var(--diff-removed)',
          }}>
            {errorMsg}
          </div>
        )}

        <div style={{ ...s.body, fontSize: 11, color: 'var(--text-secondary)' }}>
          {status === 'draft' && `created by: ${version.created_by} · ${formatDate(version.created_at)}`}
          {status === 'in_review' && `created by: ${version.created_by} · submitted: ${formatDate(version.updated_at)}`}
          {status === 'approved' && `approved by: ${version.reviewed_by || userName} · ${formatDate(version.updated_at)}`}
          {status === 'published' && `published by: ${version.created_by} · ${formatDate(version.published_at || version.updated_at)}`}
        </div>

        {(status === 'draft' || status === 'in_review') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={s.sectionTitle}>// compare</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {/* Previous published */}
              <div style={{
                flex: 1, height: 100, background: 'var(--bg-active)',
                border: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden',
              }}>
                {latest?.thumbnail_url ? (
                  <img src={latest.thumbnail_url} style={{ maxWidth: '90%', maxHeight: 72, objectFit: 'contain' }} />
                ) : (
                  <span style={{ ...s.label, fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {latest ? 'no thumbnail' : 'first version'}
                  </span>
                )}
                <span style={{ ...s.label, fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
                  {latest ? `v${currentVer}` : '—'}
                </span>
              </div>
              <span style={{ ...s.label, fontSize: 12, color: 'var(--text-tertiary)' }}>→</span>
              {/* Current draft */}
              <div style={{
                flex: 1, height: 100, background: 'var(--bg-active)',
                border: `1px solid ${statusColor[status]}40`, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden',
              }}>
                {comp.thumbnailBytes.length > 0 ? (
                  <img
                    src={URL.createObjectURL(new Blob([new Uint8Array(comp.thumbnailBytes)], { type: 'image/png' }))}
                    style={{ maxWidth: '90%', maxHeight: 72, objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ ...s.label, fontSize: 20, color: statusColor[status] }}>◆</span>
                )}
                <span style={{ ...s.label, fontSize: 9, color: statusColor[status], fontWeight: 'normal' }}>
                  {statusLabel[status]}
                </span>
              </div>
            </div>
          </div>
        )}

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={s.sectionTitle}>// changes vs v{currentVer}</span>
          {loadingDiff ? (
            <div style={{ ...s.body, fontSize: 11, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center' }}>
              comparing snapshots...
            </div>
          ) : (
            <DiffBlock lines={diffLines} />
          )}
        </div>

        {status === 'in_review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={s.sectionTitle}>// review note (optional)</span>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 10 }}>
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

        {status === 'approved' && (
          <div style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
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
            <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', padding: 10 }}>
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

        {status === 'draft' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
            <button style={{ ...s.btnPrimary, width: '100%' }} onClick={handleSubmitForReview} disabled={loading || reextracting}>
              $ submit_for_review
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{ ...s.btnSecondary, flex: 1, opacity: reextracting ? 0.5 : 1 }}
                onClick={handleReextract}
                disabled={loading || reextracting}
              >
                {reextracting ? 'extracting...' : '$ re-extract'}
              </button>
              <button
                style={{ ...s.btnDanger, flex: 1 }}
                onClick={handleDiscard}
                disabled={loading || reextracting}
              >
                discard draft
              </button>
            </div>
          </div>
        )}

        {auditLog.length > 0 && (
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

  const published = versions.filter(v => v.status === 'published' || v.status === 'deprecated');
  const pending = versions.filter(v => !['published', 'deprecated'].includes(v.status));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
  | { screen: 'auth' }
  | { screen: 'library-setup' }
  | { screen: 'library' }
  | { screen: 'detail'; comp: ExtractedComponent }
  | { screen: 'detail-version'; version: ComponentVersion; comp: ExtractedComponent }
  | { screen: 'history'; comp: ExtractedComponent };

function App() {
  const [view, setView] = React.useState<View>({ screen: 'auth' });
  const [userName, setUserName] = React.useState('');
  const [figmaToken, setFigmaToken] = React.useState<string | null>(null);
  const [libraryFileKey, setLibraryFileKey] = React.useState<string | null>(null);
  const [libraryName, setLibraryName] = React.useState('');
  const [projectId, setProjectId] = React.useState<string | null>(null);

  // Listen to code.ts init message (with saved settings)
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as CodeMessage;
      if (!msg) return;

      if (msg.type === 'init') {
        setUserName(msg.userName);

        // Restore saved OAuth session
        if (msg.savedToken) {
          setFigmaToken(msg.savedToken);
          if (msg.savedUserName) setUserName(msg.savedUserName);

          if (msg.savedFileKey) {
            setLibraryFileKey(msg.savedFileKey);
            // Fetch library name and set up project
            getLibraryInfo(msg.savedFileKey, msg.savedToken)
              .then(info => {
                setLibraryName(info.name);
                return getOrCreateProject(info.name, msg.savedFileKey!);
              })
              .then(project => {
                setProjectId(project.id);
                setView({ screen: 'library' });
              })
              .catch(() => {
                // Token might be expired, show auth
                setFigmaToken(null);
                setView({ screen: 'auth' });
              });
          } else {
            setView({ screen: 'library-setup' });
          }
        } else {
          setView({ screen: 'auth' });
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleAuthenticated = (token: string, name: string) => {
    setFigmaToken(token);
    setUserName(name);
    postToCode({ type: 'save-settings', token, fileKey: '', userName: name });
    setView({ screen: 'library-setup' });
  };

  const handleLibraryConnected = async (fileKey: string, name: string) => {
    setLibraryFileKey(fileKey);
    setLibraryName(name);
    postToCode({ type: 'save-settings', token: figmaToken!, fileKey, userName });
    try {
      const p = await getOrCreateProject(name, fileKey);
      setProjectId(p.id);
    } catch (e) {
      console.error('Failed to create project:', e);
    }
    setView({ screen: 'library' });
  };

  const handleDisconnect = () => {
    setFigmaToken(null);
    setLibraryFileKey(null);
    setLibraryName('');
    setProjectId(null);
    postToCode({ type: 'clear-settings' });
    setView({ screen: 'auth' });
  };

  const handleChangeLibrary = () => {
    setLibraryFileKey(null);
    setLibraryName('');
    setProjectId(null);
    setView({ screen: 'library-setup' });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view.screen === 'auth' && (
          <AuthScreen onAuthenticated={handleAuthenticated} />
        )}

        {view.screen === 'library-setup' && figmaToken && (
          <LibrarySetupScreen
            token={figmaToken}
            onLibraryConnected={handleLibraryConnected}
            onDisconnect={handleDisconnect}
          />
        )}

        {figmaToken && libraryFileKey && projectId && (
          <div style={{ display: view.screen === 'library' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
            <LibraryComponentsScreen
              token={figmaToken}
              fileKey={libraryFileKey}
              libraryName={libraryName}
              userName={userName}
              projectId={projectId}
              visible={view.screen === 'library'}
              onViewDetail={(comp) => setView({ screen: 'detail', comp })}
              onViewHistory={(comp) => setView({ screen: 'history', comp })}
              onChangeLibrary={handleChangeLibrary}
              onDisconnect={handleDisconnect}
            />
          </div>
        )}

        {view.screen === 'detail' && projectId && (
          <VersionDetailScreen
            comp={view.comp}
            userName={userName}
            projectId={projectId}
            onBack={() => setView({ screen: 'library' })}
            onViewHistory={() => setView({ screen: 'history', comp: view.comp })}
          />
        )}

        {view.screen === 'detail-version' && projectId && (
          <VersionDetailScreen
            comp={view.comp}
            userName={userName}
            projectId={projectId}
            versionId={view.version.id}
            onBack={() => setView({ screen: 'history', comp: view.comp })}
            onViewHistory={() => setView({ screen: 'history', comp: view.comp })}
          />
        )}

        {view.screen === 'history' && projectId && (
          <VersionHistoryScreen
            comp={view.comp}
            projectId={projectId}
            onBack={() => setView({ screen: 'library' })}
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
