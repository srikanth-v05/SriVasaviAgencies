import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 " +
  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-[var(--shadow-brand)] hover:bg-brand-deep hover:shadow-[var(--shadow-md)]",
  secondary: "border border-hairline-strong bg-surface text-ink shadow-[var(--shadow-xs)] hover:border-brand hover:text-brand hover:bg-brand-tint/30",
  ghost: "text-ink-soft hover:bg-ground-deep hover:text-ink",
  danger: "border border-danger/40 bg-surface text-danger hover:bg-danger hover:text-white hover:border-danger",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return <button className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`} {...props} />;
}

export function LinkButton({
  to,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------- Panel */

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel overflow-hidden ${className}`}>{children}</section>;
}

export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline bg-surface-2/60 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------ Fields */

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, required, className = "", children }: FieldProps) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => <input ref={ref} className={`field-input ${className}`} {...props} />,
);
Input.displayName = "Input";

export const NumberInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} type="number" className={`field-input type-data text-right ${className}`} {...props} />
  ),
);
NumberInput.displayName = "NumberInput";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => (
    <select ref={ref} className={`field-input cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a7480' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => <textarea ref={ref} className={`field-input leading-relaxed ${className}`} rows={3} {...props} />,
);
Textarea.displayName = "Textarea";

/* ------------------------------------------------------------------ Status */

const STATUS_TONES: Record<string, string> = {
  DRAFT: "bg-ground-deep text-ink-soft ring-hairline-strong",
  READY_TO_ISSUE: "bg-brand-tint text-brand-deep ring-brand/20",
  SENT: "bg-zone-blue/10 text-zone-blue ring-zone-blue/20",
  ACCEPTED: "bg-zone-green/12 text-zone-green ring-zone-green/25",
  CONVERTED: "bg-brand-tint text-brand-deep ring-brand/20",
  REJECTED: "bg-zone-red/10 text-zone-red ring-zone-red/20",
  EXPIRED: "bg-ground-deep text-muted ring-hairline-strong",
  CANCELLED: "bg-ground-deep text-muted line-through ring-hairline-strong",
  ISSUED: "bg-zone-blue/10 text-zone-blue ring-zone-blue/20",
  PARTIALLY_PAID: "bg-zone-amber/14 text-zone-amber ring-zone-amber/25",
  PAID: "bg-zone-green/12 text-zone-green ring-zone-green/25",
  OVERDUE: "bg-zone-red/10 text-zone-red ring-zone-red/20",
};

export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "bg-ground-deep text-ink-soft ring-hairline-strong";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider ring-1 ring-inset ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ------------------------------------------------------------------- State */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-16 text-center">
      {icon && (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint/60 text-brand" aria-hidden>
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 px-6 py-16 text-xs text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline-strong border-t-brand" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <p className="text-sm font-medium text-danger">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Pagination */

export function Pager({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-hairline bg-surface-2/60 px-5 py-3">
      <p className="type-data text-xs text-muted">
        Page <span className="text-ink">{page}</span> of {pages} · {total} record{total === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- Table */

export function TableShell({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-ground-deep/70 backdrop-blur">
          <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-ink-soft [&_th]:border-b [&_th]:border-hairline-strong">{head}</tr>
        </thead>
        <tbody className="divide-y divide-hairline">{children}</tbody>
      </table>
    </div>
  );
}
