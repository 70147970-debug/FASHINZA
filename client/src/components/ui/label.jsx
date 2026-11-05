import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@fashinza/shared/utils.js";

export function Label({ className, ...props }) {
  return <LabelPrimitive.Root className={cn("block text-[13px] font-medium leading-5 text-ink", className)} {...props} />;
}
