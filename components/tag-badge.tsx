import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TagBadge({
  tag,
  className,
  onRemove,
}: {
  tag: Tag;
  className?: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        className
      )}
      style={{
        color: tag.color,
        backgroundColor: `${tag.color}14`,
        borderColor: `${tag.color}38`,
      }}
    >
      {tag.name}
      {onRemove && (
        // span en vez de button: este badge puede vivir dentro del trigger
        // (button) del selector de etiquetas y no se pueden anidar buttons.
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          className="-mr-0.5 cursor-pointer rounded-full leading-none opacity-60 hover:opacity-100"
          aria-label={`Quitar etiqueta ${tag.name}`}
        >
          ×
        </span>
      )}
    </span>
  );
}
