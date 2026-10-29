import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-info-line bg-info-soft", icon: "text-info", Icon: Info },
  success: { cls: "border-success-line bg-success-soft", icon: "text-success", Icon: CheckCircle2 },
  warning: { cls: "border-warning-line bg-warning-soft", icon: "text-warning", Icon: AlertTriangle },
  error: { cls: "border-danger-line bg-danger-soft", icon: "text-danger", Icon: AlertCircle },
};

/**
 * Inline message on a soft status tint with a hairline border. Errors use role="alert"; everything else is a
 * polite role="status". Pass `title` for a semibold first line; children are the body.
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
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm leading-5 text-ink", cls, className)}
      {...props}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", icon)} strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}
