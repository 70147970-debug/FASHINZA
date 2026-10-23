import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-navy-50 bg-navy-50 text-navy", Icon: Info },
  success: { cls: "border-success/20 bg-success-50 text-success", Icon: CheckCircle2 },
  error: { cls: "border-danger/20 bg-danger-50 text-danger", Icon: AlertCircle },
};

export function Alert({
  tone = "info",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof tones }) {
  const { cls, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2 rounded-md border p-3 text-sm", cls, className)} {...props}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
