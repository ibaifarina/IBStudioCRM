"use client";

import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { cn } from "@/lib/utils";

export const DEFAULT_TEMPLATE_ICON = "message-square-text";

const ICON_NAMES = new Set<string>(iconNames);

export function isTemplateIconName(name: string): name is IconName {
  return ICON_NAMES.has(name);
}

export function TemplateIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const resolved = isTemplateIconName(name)
    ? name
    : (DEFAULT_TEMPLATE_ICON as IconName);

  return (
    <DynamicIcon
      name={resolved}
      className={cn("size-4", className)}
      fallback={() => <span className={cn("size-4 animate-pulse rounded bg-muted", className)} />}
    />
  );
}
