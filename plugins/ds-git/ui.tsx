import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import type {
  CodeMessage,
  UIMessage,
  ExtractedComponent,
  ComponentVersion,
  AuditEntry,
  VersionStatus,
  BumpType,
  DiffEntry,
  DiffKind,
  Scope,
  ViewId,
} from './types';

// ── Token System ────────────────────────────────────────────────
// Maps directly to CSS custom properties defined in inline-ui.js
// All values sourced from the .pen file design tokens

const t = {
  // Backgrounds
  bgPage: 'var(--bg-page)',
  bgElevated: 'var(--bg-elevated)',
  bgCard: 'var(--bg-card)',
  bgActive: 'var(--bg-active)',

  // Text
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textTertiary: 'var(--text-tertiary)',

  // Accents
  accent: 'var(--accent)',
  accentDim: 'var(--accent-dim)',
  cyan: 'var(--cyan)',
  amber: 'var(--amber)',

  // Borders
  border: 'var(--border)',

  // Status
  statusDraft: 'var(--status-draft)',
  statusReview: 'var(--status-review)',
  statusApproved: 'var(--status-approved)',
  statusPublished: 'var(--status-published)',
  statusRejected: 'var(--status-rejected)',

  // Diff
  diffAdded: 'var(--diff-added)',
  diffChanged: 'var(--diff-changed)',
  diffRemoved: 'var(--diff-removed)',

  // Fonts
  fontMono: 'var(--font-mono)',
  fontBody: 'var(--font-body)',
} as const;

const STATUS_COLORS: Record<VersionStatus, string> = {
  draft: t.statusDraft,
  in_review: t.statusReview,
  approved: t.statusApproved,
  published: t.statusPublished,
};

const DIFF_COLORS: Record<DiffKind, string> = {
  added: t.diffAdded,
  changed: t.diffChanged,
  removed: t.diffRemoved,
};

const DIFF_BG: Record<DiffKind, string> = {
  added: '#10B98110',
  changed: '#F59E0B10',
  removed: '#EF444410',
};

const DIFF_PREFIX: Record<DiffKind, string> = {
  added: '+',
  changed: '~',
  removed: '-',
};

const BUMP_COLORS: Record<BumpType, { bg: string; text: string }> = {
  patch: { bg: '#2A2A2A', text: t.textSecondary },
  minor: { bg: '#06B6D420', text: t.cyan },
  major: { bg: '#F59E0B20', text: t.amber },
};

// ── Shared Styles ───────────────────────────────────────────────

const mono = (size: number, weight: string = 'normal'): React.CSSProperties => ({
  fontFamily: t.fontMono,
  fontSize: size,
  fontWeight: weight,
});

const body = (size: number, weight: string = 'normal'): React.CSSProperties => ({
  fontFamily: t.fontBody,
  fontSize: size,
  fontWeight: weight,
});

// ── Components ──────────────────────────────────────────────────

// Button variants

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  onClick?: () => void;
}

function Button({ label, variant = 'primary', fullWidth, onClick }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    background: 'none',
    width: fullWidth ? '100%' : undefined,
  };

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      ...base,
      background: t.accent,
      color: '#0A0A0A',
      gap: 6,
      padding: '8px 16px',
      ...mono(12, '500'),
    },
    secondary: {
      ...base,
      color: t.textPrimary,
      gap: 6,
      padding: '8px 16px',
      border: `1px solid ${t.border}`,
      ...mono(12),
    },
    ghost: {
      ...base,
      color: t.accent,
      gap: 4,
      padding: '6px 10px',
      ...mono(11),
    },
    danger: {
      ...base,
      color: t.diffRemoved,
      gap: 6,
      padding: '8px 16px',
      border: `1px solid ${t.diffRemoved}`,
      ...mono(12),
    },
  };

  return (
    <button style={variants[variant]} onClick={onClick}>
      {variant === 'primary' && <span style={{ ...mono(12, '500') }}>$</span>}
      {variant === 'primary' ? ` ${label}` : label}
    </button>
  );
}

// Status Badge

interface StatusBadgeProps {
  status: VersionStatus;
  label?: string;
}

function StatusBadge({ status, label }: StatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const text = label || status.replace('_', ' ');

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        border: `1px solid ${color}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ color, ...mono(10, '500') }}>{text}</span>
    </span>
  );
}

// Bump Badge

interface BumpBadgeProps {
  bump: BumpType;
}

function BumpBadge({ bump }: BumpBadgeProps) {
  const { bg, text } = BUMP_COLORS[bump];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        background: bg,
        color: text,
        ...mono(10, '500'),
      }}
    >
      {bump}
    </span>
  );
}

// Diff Line

interface DiffLineProps {
  kind: DiffKind;
  text: string;
}

function DiffLine({ kind, text }: DiffLineProps) {
  const color = DIFF_COLORS[kind];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        background: DIFF_BG[kind],
        width: '100%',
      }}
    >
      <span style={{ color, ...mono(11, '700'), flexShrink: 0 }}>
        {DIFF_PREFIX[kind]}
      </span>
      <span style={{ color, ...body(11), flex: 1 }}>{text}</span>
    </div>
  );
}

// Diff Box (container for diff lines)

interface DiffBoxProps {
  diffs: DiffEntry[];
  title?: string;
}

function DiffBox({ diffs, title }: DiffBoxProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {title && (
        <span style={{ color: t.textSecondary, ...mono(11) }}>{title}</span>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: 8,
          border: `1px solid ${t.border}`,
          width: '100%',
        }}
      >
        {diffs.map((d, i) => (
          <DiffLine key={i} kind={d.kind} text={d.message} />
        ))}
      </div>
    </div>
  );
}

// Stepper

const STEP_LABELS: VersionStatus[] = ['draft', 'in_review', 'approved', 'published'];
const STEP_DISPLAY: Record<VersionStatus, string> = {
  draft: 'draft',
  in_review: 'review',
  approved: 'approved',
  published: 'published',
};

const STEP_ACTIVE_COLORS: Record<VersionStatus, string> = {
  draft: t.accent,
  in_review: t.cyan,
  approved: t.amber,
  published: t.accent,
};

interface StepperProps {
  currentStatus: VersionStatus;
}

function Stepper({ currentStatus }: StepperProps) {
  const currentIndex = STEP_LABELS.indexOf(currentStatus);

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {STEP_LABELS.map((step, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isActive = isPast || isCurrent;

        let dotColor = t.border;
        let textColor = t.textTertiary;
        let lineColor = t.border;

        if (isPast) {
          dotColor = t.accent;
          textColor = t.accent;
          lineColor = t.accent;
        } else if (isCurrent) {
          dotColor = STEP_ACTIVE_COLORS[step];
          textColor = STEP_ACTIVE_COLORS[step];
        }

        return (
          <React.Fragment key={step}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                flex: 1,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: dotColor,
                }}
              />
              <span style={{ color: textColor, ...mono(10, isActive ? '500' : 'normal') }}>
                {STEP_DISPLAY[step]}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: isPast ? t.accent : t.border,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Section Comment (the "// section_name" labels)

function SectionLabel({ text }: { text: string }) {
  return (
    <span style={{ color: t.textSecondary, ...mono(11) }}>// {text}</span>
  );
}

// Version Picker (patch / minor / major radio)

interface VersionPickerProps {
  currentVersion: string;
  selected: BumpType;
  onSelect: (bump: BumpType) => void;
}

function computeVersion(current: string, bump: BumpType): string {
  const parts = current.replace(/^v/, '').split('.').map(Number);
  if (parts.length !== 3) return current;
  const [major, minor, patch] = parts;
  switch (bump) {
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'major': return `${major + 1}.0.0`;
  }
}

function VersionPicker({ currentVersion, selected, onSelect }: VersionPickerProps) {
  const bumps: BumpType[] = ['patch', 'minor', 'major'];

  return (
    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
      {bumps.map((bump) => {
        const isSelected = bump === selected;
        return (
          <button
            key={bump}
            onClick={() => onSelect(bump)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 12px',
              background: isSelected ? t.accentDim : 'none',
              border: `1px solid ${isSelected ? t.accent : t.border}`,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <span
              style={{
                color: isSelected ? t.accent : t.textSecondary,
                ...mono(11, isSelected ? '700' : 'normal'),
              }}
            >
              {bump}
            </span>
            <span
              style={{
                color: isSelected ? t.accent : t.textTertiary,
                ...mono(10),
              }}
            >
              {computeVersion(currentVersion, bump)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Textarea

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function TextArea({ value, onChange, placeholder }: TextAreaProps) {
  return (
    <div
      style={{
        background: t.bgPage,
        border: `1px solid ${t.border}`,
        padding: 10,
        width: '100%',
      }}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          minHeight: 64,
          background: 'none',
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          color: t.textPrimary,
          ...body(11),
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

// Audit Trail Entry

interface AuditRowProps {
  time: string;
  user: string;
  action: string;
  highlight?: boolean;
}

function AuditRow({ time, user, action, highlight }: AuditRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <span style={{ color: t.textTertiary, ...mono(10) }}>{time}</span>
      <span style={{ color: t.textSecondary, ...mono(10) }}>{user}</span>
      <span style={{ color: highlight ? t.accent : t.textPrimary, ...body(10) }}>
        {action}
      </span>
    </div>
  );
}

// Audit Trail Section

interface AuditTrailProps {
  entries: AuditEntry[];
}

function AuditTrail({ entries }: AuditTrailProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <SectionLabel text="audit_trail" />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '8px 12px',
          border: `1px solid ${t.border}`,
        }}
      >
        {entries.map((e, i) => {
          const date = new Date(e.created_at);
          const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          const isLast = i === entries.length - 1;
          return (
            <AuditRow
              key={e.id}
              time={time}
              user={e.performed_by}
              action={e.action.replace(/_/g, ' ')}
              highlight={isLast && e.action === 'published'}
            />
          );
        })}
      </div>
    </div>
  );
}

// Thumbnail comparison

interface ThumbnailCompareProps {
  prevLabel: string;
  currLabel: string;
  prevUrl?: string;
  currUrl?: string;
  accentColor?: string;
}

function ThumbnailCompare({ prevLabel, currLabel, prevUrl, currUrl, accentColor = t.accentDim }: ThumbnailCompareProps) {
  const thumbStyle = (borderColor: string): React.CSSProperties => ({
    flex: 1,
    height: 80,
    background: t.bgActive,
    border: `1px solid ${borderColor}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <SectionLabel text="thumbnails" />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
        <div style={thumbStyle(t.border)}>
          {prevUrl
            ? <img src={prevUrl} style={{ maxWidth: '100%', maxHeight: '100%' }} />
            : <span style={{ color: t.textTertiary, ...mono(10) }}>{prevLabel}</span>
          }
        </div>
        <span style={{ color: t.textTertiary, ...mono(12) }}>&gt;&gt;</span>
        <div style={thumbStyle(accentColor)}>
          {currUrl
            ? <img src={currUrl} style={{ maxWidth: '100%', maxHeight: '100%' }} />
            : <span style={{ color: t.accent, ...mono(10) }}>{currLabel}</span>
          }
        </div>
      </div>
    </div>
  );
}

// Component Card (Screen 1)

interface ComponentCardProps {
  component: ExtractedComponent;
  latestVersion?: ComponentVersion;
  onCreateDraft: () => void;
  onViewDraft: () => void;
  onHistory: () => void;
}

function ComponentCard({ component, latestVersion, onCreateDraft, onViewDraft, onHistory }: ComponentCardProps) {
  const hasDraft = latestVersion && latestVersion.status !== 'published';
  const hasHistory = !!latestVersion;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        background: t.bgElevated,
        border: `1px solid ${t.border}`,
        width: '100%',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: 64,
          height: 64,
          background: t.bgActive,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ color: t.textTertiary, ...mono(10) }}>
          {component.name.charAt(0)}
        </span>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {/* Top row: name + badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: t.textPrimary, ...mono(13, '700') }}>
            {component.name}
          </span>
          {latestVersion ? (
            <StatusBadge status={latestVersion.status} />
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                border: `1px solid ${t.textTertiary}`,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.textTertiary }} />
              <span style={{ color: t.textTertiary, ...mono(10, '500') }}>no versions</span>
            </span>
          )}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {latestVersion && (
            <>
              <span style={{ color: hasDraft ? t.statusDraft : t.accent, ...mono(11, '500') }}>
                {hasDraft ? `v${latestVersion.version}-${latestVersion.status}` : `v${latestVersion.version}`}
              </span>
              <span style={{ color: t.textTertiary, ...mono(11) }}>&middot;</span>
            </>
          )}
          <span style={{ color: t.textSecondary, ...body(11) }}>
            {component.variantCount} variant{component.variantCount !== 1 ? 's' : ''} &middot; {component.propertyCount} prop{component.propertyCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Date / author */}
        {latestVersion && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: t.textTertiary, ...body(10) }}>
              {hasDraft
                ? `draft by: ${latestVersion.created_by}`
                : formatDate(latestVersion.published_at || latestVersion.created_at)
              }
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {hasDraft ? (
            <Button label="view draft" variant="primary" onClick={onViewDraft} />
          ) : (
            <Button label="create draft" variant="secondary" onClick={onCreateDraft} />
          )}
          {hasHistory && (
            <Button label="history" variant="ghost" onClick={onHistory} />
          )}
        </div>
      </div>
    </div>
  );
}

// Version History Entry (Screen 3)

interface HistoryEntryProps {
  version: ComponentVersion;
  onViewDetails: () => void;
  onExportJson: () => void;
}

function HistoryEntry({ version, onViewDetails, onExportJson }: HistoryEntryProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        background: t.bgElevated,
        border: `1px solid ${t.border}`,
        width: '100%',
      }}
    >
      {/* Top: version + bump + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: t.accent, ...mono(12, '700') }}>v{version.version}</span>
          {version.bump_type && <BumpBadge bump={version.bump_type} />}
        </div>
        <span style={{ color: t.textTertiary, ...body(10) }}>
          {formatDate(version.published_at || version.created_at)} &middot; {version.created_by}
        </span>
      </div>

      {/* Changelog message */}
      {version.changelog_message && (
        <span style={{ color: t.textSecondary, ...body(11), lineHeight: 1.4 }}>
          {version.changelog_message}
        </span>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button label="view details" variant="ghost" onClick={onViewDetails} />
        <Button label="export json" variant="ghost" onClick={onExportJson} />
      </div>
    </div>
  );
}

// Published card (Screen 2D)

interface PublishedCardProps {
  version: ComponentVersion;
}

function PublishedCard({ version }: PublishedCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: '#10B98115',
        border: `1px solid ${t.accentDim}`,
        width: '100%',
      }}
    >
      <span style={{ color: t.accent, fontSize: 20 }}>&#10003;</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <span style={{ color: t.accent, ...mono(12, '700') }}>published</span>
        <span style={{ color: t.textSecondary, ...body(10) }}>
          v{version.version} ({version.bump_type}) &middot; {formatDate(version.published_at || version.created_at)} &middot; {version.created_by}
        </span>
      </div>
    </div>
  );
}

// ── Layout Components ───────────────────────────────────────────

// Header bar (top of every screen)

interface HeaderProps {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}

function Header({ title, right, onBack }: HeaderProps) {
  if (onBack) {
    // Detail/History header
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: `1px solid ${t.border}`,
          width: '100%',
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: t.accent,
            cursor: 'pointer',
            ...mono(12),
          }}
        >
          &lt; back
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {right}
        </div>
      </div>
    );
  }

  // Main header (Screen 1)
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        borderBottom: `1px solid ${t.border}`,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ color: t.accent, ...mono(16, '700') }}>&gt;</span>
        <span style={{ color: t.textPrimary, ...mono(14, '700') }}>component_changelog</span>
      </div>
      <span style={{ color: t.textTertiary, ...mono(11) }}>v0.1</span>
    </div>
  );
}

// Toolbar (scope + extract all)

interface ToolbarProps {
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  onExtractAll: () => void;
  isExtracting: boolean;
}

function Toolbar({ scope, onScopeChange, onExtractAll, isExtracting }: ToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        borderBottom: `1px solid ${t.border}`,
        width: '100%',
      }}
    >
      <button
        onClick={() => onScopeChange(scope === 'page' ? 'selection' : 'page')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          border: `1px solid ${t.border}`,
          background: 'none',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <span style={{ color: t.textSecondary, ...mono(11) }}>scope:</span>
        <span style={{ color: t.textPrimary, ...mono(11, '500') }}>{scope}</span>
        <span style={{ color: t.textTertiary, ...mono(9) }}>v</span>
      </button>
      <Button
        label={isExtracting ? 'extracting...' : 'extract_all'}
        variant="primary"
        onClick={onExtractAll}
      />
    </div>
  );
}

// Search bar

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
}

function SearchBar({ query, onChange }: SearchBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 20px',
        borderBottom: `1px solid ${t.border}`,
        width: '100%',
      }}
    >
      <span style={{ color: t.textTertiary, ...mono(12, '700') }}>/</span>
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="search components..."
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          color: t.textPrimary,
          ...body(12),
        }}
      />
    </div>
  );
}

// Progress bar

interface ProgressBarProps {
  message: string;
  percent: number;
}

function ProgressBar({ message, percent }: ProgressBarProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 20px', width: '100%' }}>
      <span style={{ color: t.textSecondary, ...mono(11) }}>{message}</span>
      <div style={{ width: '100%', height: 2, background: t.border }}>
        <div style={{ width: `${percent}%`, height: '100%', background: t.accent, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// ── Utility ─────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function postToCode(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

// ── App ─────────────────────────────────────────────────────────

function App() {
  // State
  const [userName, setUserName] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [scope, setScope] = useState<Scope>('page');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ message: '', percent: 0 });
  const [components, setComponents] = useState<ExtractedComponent[]>([]);
  const [versions, setVersions] = useState<Map<string, ComponentVersion[]>>(new Map());
  const [view, setView] = useState<ViewId>('list');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ComponentVersion | null>(null);
  const [bumpType, setBumpType] = useState<BumpType>('minor');
  const [changelogMessage, setChangelogMessage] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Message handler
  useEffect(() => {
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage as CodeMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'init':
          setUserName(msg.userName);
          setFileKey(msg.fileKey);
          break;
        case 'extraction-complete':
          setComponents(msg.components);
          setIsExtracting(false);
          break;
        case 'extraction-progress':
          setExtractProgress({ message: msg.message, percent: msg.percent });
          break;
        case 'error':
          setError(msg.message);
          setIsExtracting(false);
          break;
      }
    };
  }, []);

  // Helpers
  const handleExtractAll = () => {
    setIsExtracting(true);
    setError(null);
    postToCode({ type: 'extract-components', scope });
  };

  const getLatestVersion = (componentKey: string): ComponentVersion | undefined => {
    const vs = versions.get(componentKey);
    return vs?.[0];
  };

  const filteredComponents = components.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const navigateToDetail = (key: string, version?: ComponentVersion) => {
    setSelectedKey(key);
    setSelectedVersion(version || null);
    setView('detail');
    setChangelogMessage('');
    setReviewNote('');
    setBumpType('minor');
  };

  const navigateToHistory = (key: string) => {
    setSelectedKey(key);
    setView('history');
  };

  const goBack = () => {
    setView('list');
    setSelectedKey(null);
    setSelectedVersion(null);
    setError(null);
  };

  // Get selected component info
  const selectedComponent = components.find((c) => c.key === selectedKey);
  const selectedVersions = selectedKey ? (versions.get(selectedKey) || []) : [];
  const publishedVersions = selectedVersions.filter((v) => v.status === 'published');

  // ── Render ──────────────────────────────────────────────────

  // Screen 1: Component List
  if (view === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bgPage }}>
        <Header />
        <Toolbar
          scope={scope}
          onScopeChange={setScope}
          onExtractAll={handleExtractAll}
          isExtracting={isExtracting}
        />
        <SearchBar query={searchQuery} onChange={setSearchQuery} />

        {/* Count bar */}
        <div style={{ padding: '8px 20px' }}>
          <span style={{ color: t.textSecondary, ...mono(11) }}>
            // found {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '8px 20px', color: t.diffRemoved, ...mono(11) }}>
            error: {error}
          </div>
        )}

        {/* Progress */}
        {isExtracting && (
          <ProgressBar message={extractProgress.message} percent={extractProgress.percent} />
        )}

        {/* Component list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '0 16px 16px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {filteredComponents.map((c) => (
            <ComponentCard
              key={c.key}
              component={c}
              latestVersion={getLatestVersion(c.key)}
              onCreateDraft={() => navigateToDetail(c.key)}
              onViewDraft={() => navigateToDetail(c.key, getLatestVersion(c.key))}
              onHistory={() => navigateToHistory(c.key)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Screen 2: Version Detail
  if (view === 'detail' && selectedVersion) {
    const v = selectedVersion;
    const diffs = (v.diff || []) as DiffEntry[];
    const prevVersion = publishedVersions.find(
      (pv) => pv.id !== v.id && pv.status === 'published'
    );

    // Screen 2A: Draft
    if (v.status === 'draft') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bgPage }}>
          <Header
            onBack={goBack}
            right={
              <>
                <span style={{ color: t.textPrimary, ...mono(13, '700') }}>{v.component_name}</span>
                <span style={{ color: t.textSecondary, ...mono(12) }}>v{v.version}</span>
              </>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
            <Stepper currentStatus="draft" />
            <span style={{ color: t.textSecondary, ...body(11) }}>
              created by: {v.created_by} &middot; {formatDate(v.created_at)}
            </span>
            <ThumbnailCompare
              prevLabel={prevVersion ? `v${prevVersion.version}` : 'none'}
              currLabel="draft"
            />
            {diffs.length > 0 && (
              <DiffBox diffs={diffs} title={`// changes vs v${prevVersion?.version || '0.0.0'}`} />
            )}
            <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
              <Button label="submit_for_review" variant="primary" fullWidth />
            </div>
          </div>
        </div>
      );
    }

    // Screen 2B: In Review
    if (v.status === 'in_review') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bgPage }}>
          <Header
            onBack={goBack}
            right={
              <>
                <span style={{ color: t.textPrimary, ...mono(13, '700') }}>{v.component_name}</span>
                <span style={{ color: t.textSecondary, ...mono(12) }}>v{v.version}</span>
              </>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
            <Stepper currentStatus="in_review" />
            <span style={{ color: t.textSecondary, ...body(11) }}>
              created by: {v.created_by} &middot; submitted: {formatDate(v.updated_at)}
            </span>
            <ThumbnailCompare
              prevLabel={prevVersion ? `v${prevVersion.version}` : 'none'}
              currLabel="draft"
              accentColor="#06B6D430"
            />
            {diffs.length > 0 && (
              <DiffBox diffs={diffs} title={`// changes vs v${prevVersion?.version || '0.0.0'}`} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              <SectionLabel text="review note (optional)" />
              <TextArea value={reviewNote} onChange={setReviewNote} placeholder="Write review notes..." />
            </div>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <Button label="reject" variant="danger" fullWidth />
              <Button label="approve" variant="primary" fullWidth />
            </div>
          </div>
        </div>
      );
    }

    // Screen 2C: Approved
    if (v.status === 'approved') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bgPage }}>
          <Header
            onBack={goBack}
            right={
              <>
                <span style={{ color: t.textPrimary, ...mono(13, '700') }}>{v.component_name}</span>
                <span style={{ color: t.textSecondary, ...mono(12) }}>v{v.version}</span>
              </>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
            <Stepper currentStatus="approved" />
            <span style={{ color: t.textSecondary, ...body(11) }}>
              approved by: {v.reviewed_by || v.created_by} &middot; {formatDate(v.updated_at)}
            </span>
            {diffs.length > 0 && (
              <DiffBox diffs={diffs} title={`// changes vs v${prevVersion?.version || '0.0.0'}`} />
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 16,
                background: t.bgElevated,
                border: `1px solid ${t.border}`,
                width: '100%',
              }}
            >
              <SectionLabel text="publish" />
              <span style={{ color: t.textPrimary, ...mono(11) }}>version bump:</span>
              <VersionPicker
                currentVersion={prevVersion?.version || '0.0.0'}
                selected={bumpType}
                onSelect={setBumpType}
              />
              <span style={{ color: t.textPrimary, ...mono(11) }}>changelog message:</span>
              <TextArea
                value={changelogMessage}
                onChange={setChangelogMessage}
                placeholder="Describe the changes..."
              />
              <Button
                label={`publish v${computeVersion(prevVersion?.version || '0.0.0', bumpType)}`}
                variant="primary"
                fullWidth
              />
            </div>
          </div>
        </div>
      );
    }

    // Screen 2D: Published
    if (v.status === 'published') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bgPage }}>
          <Header
            onBack={goBack}
            right={
              <>
                <span style={{ color: t.textPrimary, ...mono(13, '700') }}>{v.component_name}</span>
                <span style={{ color: t.textSecondary, ...mono(12) }}>v{v.version}</span>
              </>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
            <Stepper currentStatus="published" />
            <PublishedCard version={v} />
            {v.changelog_message && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                <SectionLabel text="changelog" />
                <div
                  style={{
                    padding: 12,
                    border: `1px solid ${t.border}`,
                    width: '100%',
                  }}
                >
                  <span style={{ color: t.textPrimary, ...body(11), lineHeight: 1.5 }}>
                    {v.changelog_message}
                  </span>
                </div>
              </div>
            )}
            {diffs.length > 0 && (
              <DiffBox diffs={diffs} title="// changes" />
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', width: '100%' }}>
              <Button label="view history" variant="secondary" onClick={() => navigateToHistory(v.component_key)} />
              <Button label="export json" variant="secondary" />
            </div>
          </div>
        </div>
      );
    }
  }

  // Screen 2 fallback: no version selected (new draft view)
  if (view === 'detail' && !selectedVersion && selectedComponent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bgPage }}>
        <Header
          onBack={goBack}
          right={
            <span style={{ color: t.textPrimary, ...mono(13, '700') }}>{selectedComponent.name}</span>
          }
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px', alignItems: 'center', flex: 1 }}>
          <span style={{ color: t.textSecondary, ...body(11) }}>
            no draft exists yet. extract this component to create a draft.
          </span>
          <Button
            label="extract_component"
            variant="primary"
            onClick={() => postToCode({ type: 'extract-single', nodeId: selectedComponent.nodeId })}
          />
        </div>
      </div>
    );
  }

  // Screen 3: Version History
  if (view === 'history' && selectedComponent) {
    const pendingVersions = selectedVersions.filter((v) => v.status !== 'published');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bgPage }}>
        <Header
          onBack={goBack}
          right={
            <>
              <span style={{ color: t.textPrimary, ...mono(13, '700') }}>{selectedComponent.name}</span>
              <span style={{ color: t.textSecondary, ...mono(12) }}>history</span>
            </>
          }
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          <SectionLabel text="published_versions" />
          {publishedVersions.map((v) => (
            <HistoryEntry
              key={v.id}
              version={v}
              onViewDetails={() => navigateToDetail(v.component_key, v)}
              onExportJson={() => {}}
            />
          ))}
          {publishedVersions.length === 0 && (
            <span style={{ color: t.textTertiary, ...body(11) }}>
              no published versions yet.
            </span>
          )}

          {/* Pending section */}
          {pendingVersions.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 12,
                background: t.bgElevated,
                border: '1px solid #6B728040',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: t.statusDraft,
                  }}
                />
                <span style={{ color: t.textSecondary, ...mono(11) }}>
                  pending: {pendingVersions.length} draft{pendingVersions.length !== 1 ? 's' : ''} in progress
                </span>
              </div>
              {pendingVersions.map((v) => (
                <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: t.textTertiary, ...body(11) }}>
                    v{v.version} ({v.status.replace('_', ' ')}) by {v.created_by}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      label="view draft"
                      variant="primary"
                      onClick={() => navigateToDetail(v.component_key, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: empty state
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bgPage }}>
      <Header />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: 12,
          padding: 20,
        }}
      >
        <span style={{ color: t.textSecondary, ...mono(11) }}>
          // select scope and extract components to begin
        </span>
      </div>
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────────

ReactDOM.render(<App />, document.getElementById('root'));
