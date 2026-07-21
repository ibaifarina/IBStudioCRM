"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Oscuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const;

const emptySubscribe = () => () => {};

export function ThemeToggle({
  className,
  segmented = false,
  size = "default",
}: {
  className?: string;
  segmented?: boolean;
  size?: "default" | "large";
}) {
  const { theme, setTheme } = useTheme();
  // true en cliente, false en SSR: evita desajuste de hidratación sin efectos
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const large = size === "large";
  const selectedTheme = mounted && theme ? theme : "system";
  const selectedOption =
    OPTIONS.find((option) => option.value === selectedTheme) ?? OPTIONS[2];
  const SelectedIcon = selectedOption.icon;

  if (segmented) {
    return (
      <ToggleGroup
        value={[selectedTheme]}
        onValueChange={(values) => {
          const nextTheme = values[0];
          if (nextTheme) setTheme(nextTheme);
        }}
        spacing={1}
        size="sm"
        aria-label="Seleccionar tema"
        className={cn(
          "w-full rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-0.5",
          className
        )}
      >
        {OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              aria-label={`Tema ${option.label.toLowerCase()}`}
              title={option.label}
              className="h-7 grow basis-0 rounded-[11px] p-0 text-sidebar-foreground/55 data-[state=on]:bg-sidebar data-[state=on]:text-sidebar-foreground data-[state=on]:shadow-xs"
            >
              <Icon />
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size={large ? "icon-lg" : "icon"}
            className={cn(large && "size-11 [&_svg]:size-5", className)}
            aria-label="Cambiar tema"
            title={`Tema: ${selectedOption.label}`}
          >
            <SelectedIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-36">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={selectedTheme}
            onValueChange={setTheme}
          >
            {OPTIONS.map((option) => {
              const Icon = option.icon;

              return (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                >
                  <Icon />
                  {option.label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
