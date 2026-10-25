import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-navy-100 bg-info-50", icon: "text-slate-blue", Icon: Info },
  success: { cls: "border-success-100 bg-success-50", icon: "text-success", Icon: CheckCircle2 },
  warning: { cls: "border-warning-100 bg-warning-50", icon: "text-warning", Icon: AlertTriangle },
  error: { cls: "border-danger-100 bg-danger-50", icon: "text-danger", Icon: AlertCircle },
};

/**
 * Inline message. Errors use role="alert"; everything else is a polite role="status".
 * Pass `title` for a bold first line; children are the body.
 */
export function Alert({
  tone = "info",
  title,
  className,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & { tone?: keyof typeof tones; title?: React.ReactNode }) {
  const { cls, icon, Icon } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-5 text-ink", cls, className)}
      {...props}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-navy">{title}</p>}
        {children}
      </div>
    </div>
  );
}
