"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Oscuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const;

const emptySubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // true en cliente, false en SSR: evita desajuste de hidratación sin efectos
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-0.5",
        className
      )}
    >
      {OPTIONS.map((opt) => {
        const active = mounted && theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            title={opt.label}
            aria-label={`Tema ${opt.label.toLowerCase()}`}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md py-1 transition-colors",
              active
                ? "bg-sidebar text-sidebar-primary shadow-xs"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
            )}
          >
            <opt.icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
