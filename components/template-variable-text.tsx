import { splitMessageTemplate } from "@/lib/message-templates";
import { cn } from "@/lib/utils";

const VARIABLE_STYLES = [
  {
    token: "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
    soft: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
  },
  {
    token: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    soft: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
  {
    token: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
    soft: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
  },
  {
    token: "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    soft: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  },
  {
    token: "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
    soft: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
  },
  {
    token: "border-cyan-200 bg-cyan-100 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
    soft: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200",
  },
] as const;

export function templateVariableStyle(key: string) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return VARIABLE_STYLES[Math.abs(hash) % VARIABLE_STYLES.length];
}

export function TemplateVariableToken({
  variableKey,
  children,
  className,
}: {
  variableKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium whitespace-nowrap",
        templateVariableStyle(variableKey).token,
        className
      )}
    >
      {children}
    </span>
  );
}

export function TemplateMessageText({
  content,
  values = {},
  className,
}: {
  content: string;
  values?: Record<string, string>;
  className?: string;
}) {
  return (
    <div className={cn("whitespace-pre-wrap", className)}>
      {splitMessageTemplate(content).map((part, index) =>
        part.type === "text" ? (
          <span key={`${index}-${part.value.slice(0, 8)}`}>{part.value}</span>
        ) : (
          <TemplateVariableToken
            key={`${index}-${part.key}`}
            variableKey={part.key}
          >
            {values[part.key]?.trim() || `[${part.label}]`}
          </TemplateVariableToken>
        )
      )}
    </div>
  );
}
