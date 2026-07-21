"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartPieIcon,
  MapIcon,
  PlusIcon,
  SearchIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { openNewLead, openPalette } from "@/lib/events";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Resumen", icon: ChartPieIcon },
  { href: "/leads", label: "Leads", icon: UsersIcon },
  { href: "/mapa", label: "Mapa", icon: MapIcon },
];

export function AppSidebar({ email, name }: { email: string; name: string }) {
  const pathname = usePathname();

  return (
    <>
      <MobileBar pathname={pathname} />
      <DesktopSidebar pathname={pathname} email={email} name={name} />
    </>
  );
}

function MobileBar({ pathname }: { pathname: string }) {
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex h-12 items-center gap-1 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground md:hidden">
        <span className="text-lg font-semibold tracking-tight">
          IB&nbsp;Studio
        </span>
        <nav className="ml-3 flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle className="ml-auto" />
        <Link
          href="/cuenta"
          aria-label="Cuenta"
          aria-current={pathname.startsWith("/cuenta") ? "page" : undefined}
          title="Cuenta"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "ml-1"
          )}
        >
          <UserRoundIcon />
        </Link>
      </div>
      <Button
        size="icon-lg"
        onClick={openNewLead}
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg md:hidden [&_svg:not([class*='size-'])]:size-6"
        aria-label="Nuevo lead"
        title="Nuevo lead"
      >
        <PlusIcon />
      </Button>
    </>
  );
}

function DesktopSidebar({
  pathname,
  email,
  name,
}: {
  pathname: string;
  email: string;
  name: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="px-5 pt-6 pb-4">
        <div className="text-2xl font-semibold tracking-tight">
          IB&nbsp;Studio
        </div>
      </div>

      <div className="px-3 pb-2">
        <Button
          onClick={openNewLead}
          className="w-full justify-start gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/85"
        >
          <PlusIcon />
          Nuevo lead
          <kbd className="ml-auto rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">
            N
          </kbd>
        </Button>
        <Button
          onClick={openPalette}
          variant="ghost"
          className="mt-1 w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <SearchIcon />
          Buscar…
          <kbd className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 font-mono text-[10px] text-sidebar-foreground/70">
            ⌘K
          </kbd>
        </Button>
      </div>

      <nav className="mt-2 flex flex-col gap-0.5 border-t border-sidebar-border px-3 pt-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn("size-4", active && "text-sidebar-primary")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 px-3 py-4">
        <Link
          href="/cuenta"
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-accent"
        >
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-[11px] text-sidebar-foreground/55">
              {email}
            </span>
          </span>
        </Link>
        <ThemeToggle segmented />
      </div>
    </aside>
  );
}
