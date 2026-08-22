import { splitMessageTemplate } from "@/lib/message-templates";
import { cn } from "@/lib/utils";

const VARIABLE_STYLES = [
  {
    token: "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300",
    soft: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/20 dark:bg-violet-400/[0.08] dark:text-violet-300",
  },
  {
    token: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
    soft: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/[0.08] dark:text-emerald-300",
  },
  {
    token: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300",
    soft: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/[0.08] dark:text-sky-300",
  },
  {
    token: "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
    soft: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/[0.08] dark:text-amber-300",
  },
  {
    token: "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
    soft: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/[0.08] dark:text-rose-300",
  },
  {
    token: "border-cyan-200 bg-cyan-100 text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300",
    soft: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/[0.08] dark:text-cyan-300",
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
