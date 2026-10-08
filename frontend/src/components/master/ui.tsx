import React, { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Inbox, Loader2, Lock, X, PlugZap } from "lucide-react";
import { statusLabel } from "../../i18n/labels";
import { localizeError } from "../../i18n/errors";
import { isApiError } from "../../lib/api-error";
import { isProviderNotConfigured } from "./useResource";

/* ------------------------------------------------------------------ layout */

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, eyebrow, actions }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      {eyebrow && (
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#65D000]">
          {eyebrow}
        </div>
      )}
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-xs text-slate-500 sm:text-sm">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Card: React.FC<{
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}> = ({ title, children, className = "", actions }) => (
  <section
    className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs sm:p-5 ${className}`}
  >
    {(title || actions) && (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {title && <h2 className="text-sm font-bold text-slate-900">{title}</h2>}
        {actions}
      </div>
    )}
    {children}
  </section>
);

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-[#65D000] text-white hover:bg-[#58b700] border-transparent",
  secondary: "bg-white text-slate-700 hover:bg-slate-50 border-slate-200",
  danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }
> = ({
  variant = "secondary",
  busy,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || busy}
    aria-busy={busy || undefined}
    className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#65D000]/50 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    {...rest}
  >
    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
    {children}
  </button>
);

const BADGE_TONE: Record<string, string> = {
  green: "bg-[#EBF9E5] text-[#3E8800] border-[#C6EEB2]",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
};
const toneFor = (code: string): string => {
  const c = code.toLowerCase();
  if (
    /(active|approved|paid|delivered|completed|confirmed|ok|success|enabled|online|settled|resolved)/.test(
      c
    )
  )
    return "green";
  if (
    /(pending|review|processing|assigned|offered|created|draft|onboarding|retry|queued|in_progress)/.test(
      c
    )
  )
    return "amber";
  if (/(reject|fail|suspend|cancel|exception|revoked|down|error|late|disabled|archived)/.test(c))
    return "red";
  return "slate";
};

export const StatusBadge: React.FC<{ code?: string | null; tone?: keyof typeof BADGE_TONE }> = ({
  code,
  tone,
}) => {
  const { t } = useTranslation();
  if (!code) return <span className="text-slate-400">{t("common.dash")}</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${BADGE_TONE[tone ?? toneFor(code)]}`}
    >
      {statusLabel(t, code)}
    </span>
  );
};

/* ------------------------------------------------------------------ states */

export const ErrorBox: React.FC<{ error: unknown; onRetry?: () => void; fallbackKey?: string }> = ({
  error,
  onRetry,
  fallbackKey,
}) => {
  const { t } = useTranslation();
  if (isProviderNotConfigured(error)) return <ProviderNotice />;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{localizeError(error, fallbackKey)}</span>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary">
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
};

/** Honest state for actions that need a real external provider that is not configured here. */
export const ProviderNotice: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      data-testid="provider-not-configured"
      className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"
    >
      <PlugZap className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <div className="font-bold">{t("m.state.providerTitle")}</div>
        <div className="mt-0.5">{t("m.state.providerBody")}</div>
      </div>
    </div>
  );
};

export const DeniedBox: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      data-testid="permission-denied"
      className="flex flex-col items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-xs text-amber-900"
    >
      <Lock className="h-6 w-6" aria-hidden="true" />
      <div className="text-sm font-bold">{t("auth.denied.title")}</div>
      <div>{t("m.state.denied")}</div>
    </div>
  );
};

export const EmptyBox: React.FC<{ text?: string; hint?: string; action?: React.ReactNode }> = ({
  text,
  hint,
  action,
}) => {
  const { t } = useTranslation();
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500"
    >
      <Inbox className="h-6 w-6 text-slate-300" aria-hidden="true" />
      <div className="text-sm font-semibold text-slate-700">{text ?? t("m.state.empty")}</div>
      {hint && <div>{hint}</div>}
      {action}
    </div>
  );
};

export const LoadingBox: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loading-state"
      className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-8 text-xs text-slate-500"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {t("common.loading")}
    </div>
  );
};

/** One place that decides which of loading / denied / error / empty / loaded to render. */
export function PageState({
  loading,
  error,
  denied,
  empty,
  emptyText,
  emptyHint,
  emptyAction,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  denied?: boolean;
  empty?: boolean;
  emptyText?: string;
  emptyHint?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (denied || (isApiError(error) && error.status === 403)) return <DeniedBox />;
  if (loading) return <LoadingBox />;
  if (error) return <ErrorBox error={error} onRetry={onRetry} />;
  if (empty) return <EmptyBox text={emptyText} hint={emptyHint} action={emptyAction} />;
  return <>{children}</>;
}

export const Notice: React.FC<{ children: React.ReactNode; tone?: "ok" | "error" }> = ({
  children,
  tone = "ok",
}) => (
  <div
    role={tone === "error" ? "alert" : "status"}
    className={`rounded-xl border px-3 py-2 text-xs ${
      tone === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-[#C6EEB2] bg-[#EBF9E5] text-[#3E8800]"
    }`}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ forms */

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
}> = ({ label, hint, children }) => {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
};

export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 disabled:bg-slate-50";

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
>(({ label, hint, className = "", ...rest }, ref) => (
  <Field label={label} hint={hint}>
    {(id) => <input id={id} ref={ref} className={`${inputCls} ${className}`} {...rest} />}
  </Field>
));
TextInput.displayName = "TextInput";

export const SelectInput: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }
> = ({ label, hint, className = "", children, ...rest }) => (
  <Field label={label} hint={hint}>
    {(id) => (
      <select id={id} className={`${inputCls} ${className}`} {...rest}>
        {children}
      </select>
    )}
  </Field>
);

/* ------------------------------------------------------------------ dialogs */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Accessible modal: labelled, Esc closes, Tab stays inside, focus returns to the opener. */
export const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: boolean;
}> = ({ open, title, onClose, children, footer, side }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first =
      el?.querySelector<HTMLElement>("textarea,input,select") ??
      el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => opener.current?.focus?.();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const firstN = nodes[0];
    const lastN = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === firstN) {
      e.preventDefault();
      lastN.focus();
    } else if (!e.shiftKey && document.activeElement === lastN) {
      e.preventDefault();
      firstN.focus();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex bg-black/40 ${side ? "justify-end" : "items-center justify-center p-4"}`}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className={
          side
            ? "flex h-full w-full max-w-lg flex-col bg-white shadow-xl"
            : "flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
        }
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <h2 id={titleId} className="min-w-0 text-base font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const Drawer: React.FC<Omit<React.ComponentProps<typeof Modal>, "side">> = (p) => (
  <Modal {...p} side />
);

/**
 * Confirmation for destructive / sensitive actions. The reason is REQUIRED (min 3 chars) and is
 * sent to the backend, which audits it. The dialog stays open and shows the error if the call fails.
 */
export const ReasonDialog: React.FC<{
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  reasonLabel?: string;
  danger?: boolean;
  /** When false the note is optional (e.g. confirming a cash deposit). */
  required?: boolean;
  busy?: boolean;
  error?: unknown;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  /** Extra fields shown under the reason (for example a reason code). */
  children?: React.ReactNode;
}> = ({
  open,
  title,
  description,
  confirmLabel,
  reasonLabel,
  danger,
  required = true,
  busy,
  error,
  onConfirm,
  onClose,
  children,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = React.useState("");
  const id = useId();
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const valid = !required || reason.trim().length >= 3;
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={!valid}
            busy={busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-xs text-slate-600">{description}</p>}
      <div>
        <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-700">
          {reasonLabel ?? t("common.reason")}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        <textarea
          id={id}
          rows={3}
          value={reason}
          required={required}
          aria-required={required}
          onChange={(e) => setReason(e.target.value)}
          className={inputCls}
        />
        {required && !valid && reason.length > 0 && (
          <p className="mt-1 text-[11px] text-red-600">{t("m.dialog.reasonTooShort")}</p>
        )}
      </div>
      {children}
      {error ? <ErrorBox error={error} /> : null}
    </Modal>
  );
};

/* ------------------------------------------------------------------ tabs, table, pager */

export interface TabDef {
  id: string;
  label: string;
}
export const Tabs: React.FC<{
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}> = ({ tabs, active, onChange, label }) => {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[n].id);
    (e.currentTarget.parentElement?.children[n] as HTMLElement | undefined)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-4 flex flex-wrap gap-1 border-b border-slate-200"
    >
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => onKey(e, i)}
          className={`min-h-9 border-b-2 px-3 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#65D000]/50 ${
            active === tab.id
              ? "border-[#65D000] text-[#337400]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export const TabPanel: React.FC<{ id: string; active: string; children: React.ReactNode }> = ({
  id,
  active,
  children,
}) =>
  active === id ? (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  ) : null;

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  onRowClick?: (r: T) => void;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
      <table className="w-full min-w-[40rem] text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-3 py-2.5 ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              className={onRowClick ? "cursor-pointer hover:bg-slate-50/70" : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2.5 align-middle text-slate-700 ${c.className ?? ""}`}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Pager: React.FC<{ page: number; totalPages: number; onPage: (p: number) => void }> = ({
  page,
  totalPages,
  onPage,
}) => {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label={t("m.state.pagination")}
      className="mt-3 flex items-center justify-end gap-2 text-xs"
    >
      <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t("common.previous")}
      </Button>
      <span aria-live="polite">{t("m.state.pageOf", { page, total: totalPages })}</span>
      <Button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        {t("common.next")}
      </Button>
    </nav>
  );
};

export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
);

export const KV: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-0.5 break-words text-xs font-medium text-slate-800">{children}</dd>
  </div>
);

/** Yes/no confirmation without a reason (for actions whose API takes no reason). */
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ open, title, description, confirmLabel, danger, busy, error, onConfirm, onClose }) => {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant={danger ? "danger" : "primary"} busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-xs text-slate-600">{description}</p>}
      {error ? <ErrorBox error={error} /> : null}
    </Modal>
  );
};
