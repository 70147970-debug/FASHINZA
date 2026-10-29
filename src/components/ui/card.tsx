import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card: surface, 1px hairline border, 6px radius, no shadow, 20px padding.
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Upcoming payments</CardTitle>
 *       <CardAction><Link href="/payments">All payments</Link></CardAction>
 *     </CardHeader>
 *     <CardBody>…</CardBody>
 *   </Card>
 *
 * For app pages prefer <Panel> from components/app/primitives, which wires the heading id for you.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-surface", className)} {...props} />;
}

/** Title row. Add `divided` for a bottom hairline (use when the body is a list or table). */
export function CardHeader({ className, divided = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { divided?: boolean }) {
  return (
    <div
      className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-3", divided && "border-b border-line pb-4", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, as: Tag = "h3", ...props }: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return <Tag className={cn("type-heading text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-0.5 text-[13px] leading-5 text-ink-muted", className)} {...props} />;
}

/** Right-aligned header action (usually a small link or button). */
export function CardAction({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex shrink-0 items-center gap-2 text-[13px] font-medium", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

/** Legacy name for CardBody. */
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 rounded-b-lg border-t border-line bg-surface-muted/50 px-5 py-3", className)} {...props} />;
}
