import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, SkipForward } from "lucide-react";

// ── MetaCard ─────────────────────────────────────────────────────────
// Summary metric card with a small label above a large value and optional color variants
type MetaVariant = "default" | "success" | "error" | "warning";

const META_VARIANT_CLASSES: Record<MetaVariant, string> = {
  default: "bg-muted/50 border-border",
  success:
    "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
  error:
    "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
  warning:
    "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
};

const META_VALUE_CLASSES: Record<MetaVariant, string> = {
  default: "text-foreground",
  success: "text-emerald-700 dark:text-emerald-400",
  error: "text-rose-700 dark:text-rose-400",
  warning: "text-amber-700 dark:text-amber-400",
};

interface MetaCardProps {
  label: string;
  value: React.ReactNode;
  variant?: MetaVariant;
}

export function MetaCard({ label, value, variant = "default" }: MetaCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 flex flex-col gap-0.5",
        META_VARIANT_CLASSES[variant]
      )}
    >
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
        {label}
      </span>
      <span
        className={cn(
          "text-lg font-bold leading-tight",
          META_VALUE_CLASSES[variant]
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── MetaGrid ─────────────────────────────────────────────────────────
// Grid container for MetaCard items
export function MetaGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {children}
    </div>
  );
}

// ── StatusBadge ──────────────────────────────────────────────────────
type StatusType = "success" | "failed" | "skipped";

const STATUS_ICON: Record<StatusType, typeof CheckCircle2> = {
  success: CheckCircle2,
  failed: XCircle,
  skipped: SkipForward,
};

const STATUS_CLASSES: Record<StatusType, string> = {
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed:
    "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  skipped:
    "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        STATUS_CLASSES[status]
      )}
    >
      <Icon className="h-3 w-3" />
      {label ?? status}
    </span>
  );
}

// ── OutputBlock ──────────────────────────────────────────────────────
// Monospace output block with a dark background and scrolling
interface OutputBlockProps {
  content: string | null | undefined;
  maxHeight?: string;
  isError?: boolean;
}

export function OutputBlock({
  content,
  maxHeight = "200px",
  isError = false,
}: OutputBlockProps) {
  if (!content) return null;

  return (
    <pre
      className={cn(
        "text-xs font-mono p-3 rounded-md overflow-auto whitespace-pre-wrap break-all",
        isError
          ? "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
          : "bg-slate-900 text-slate-100 dark:bg-slate-950 dark:text-slate-200"
      )}
      style={{ maxHeight }}
    >
      {content}
    </pre>
  );
}

// ── SectionCard ──────────────────────────────────────────────────────
// Section card container with a title
type SectionVariant = "default" | "success" | "error";

const SECTION_BORDER_CLASSES: Record<SectionVariant, string> = {
  default: "border-border",
  success: "border-emerald-200 dark:border-emerald-800",
  error: "border-rose-200 dark:border-rose-800",
};

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  variant?: SectionVariant;
  className?: string;
}

export function SectionCard({
  title,
  children,
  variant = "default",
  className,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card",
        SECTION_BORDER_CLASSES[variant],
        className
      )}
    >
      {title && (
        <div className="px-3 py-2 border-b border-inherit">
          <h5 className="text-sm font-medium">{title}</h5>
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}

// ── KeyValueRow ──────────────────────────────────────────────────────
// Simple key-value row display
interface KeyValueRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

export function KeyValueRow({ label, value, mono = false }: KeyValueRowProps) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm py-0.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn("font-medium text-right", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

// ── FallbackJson ─────────────────────────────────────────────────────
// Fallback JSON renderer for unknown result shapes
interface FallbackJsonProps {
  data: unknown;
  emptyText?: string;
}

export function FallbackJson({ data, emptyText = "—" }: FallbackJsonProps) {
  if (data === null || data === undefined) {
    return (
      <span className="text-muted-foreground text-sm italic">{emptyText}</span>
    );
  }

  const jsonStr =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);

  return (
    <pre className="text-xs font-mono p-3 rounded-md overflow-auto max-h-[300px] bg-muted">
      {jsonStr}
    </pre>
  );
}
