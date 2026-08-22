"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  ChartPieIcon,
  FileTextIcon,
  MapIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
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
  { href: "/", label: "Resumen", mobileLabel: "Resumen", icon: ChartPieIcon },
  { href: "/leads", label: "Leads", mobileLabel: "Leads", icon: UsersIcon },
  { href: "/mapa", label: "Mapa", mobileLabel: "Mapa", icon: MapIcon },
  {
    href: "/plantillas",
    label: "Plantillas",
    mobileLabel: "Plant.",
    icon: FileTextIcon,
  },
];

const SIDEBAR_COLLAPSED_KEY = "ibstudio-sidebar-collapsed:v1";
const SIDEBAR_COLLAPSED_EVENT = "ibstudio:sidebar-collapsed-change";
let sidebarPreferenceCache: boolean | null = null;

function subscribeToSidebarPreference(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== SIDEBAR_COLLAPSED_KEY) return;
    sidebarPreferenceCache = null;
    onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
  };
}

function getSidebarPreference() {
  if (sidebarPreferenceCache !== null) return sidebarPreferenceCache;

  try {
    sidebarPreferenceCache =
      localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    sidebarPreferenceCache = false;
  }

  return sidebarPreferenceCache;
}

function getServerSidebarPreference() {
  return false;
}

export function AppSidebar({ email, name }: { email: string; name: string }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreference,
    getServerSidebarPreference
  );

  const updateCollapsed = (nextCollapsed: boolean) => {
    sidebarPreferenceCache = nextCollapsed;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextCollapsed));
    } catch {
      // The in-memory preference still works when storage is unavailable.
    }
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
  };

  return (
    <>
      <MobileBar pathname={pathname} />
      <DesktopSidebar
        pathname={pathname}
        email={email}
        name={name}
        collapsed={collapsed}
        onCollapse={() => updateCollapsed(true)}
      />
      {collapsed ? (
        <Button
          variant="outline"
          size="icon"
          onClick={() => updateCollapsed(false)}
          className="fixed top-4 left-4 z-40 hidden bg-background/90 shadow-sm backdrop-blur-sm md:inline-flex"
          aria-label="Mostrar barra lateral"
          aria-controls="app-sidebar"
          aria-expanded={false}
          title="Mostrar barra lateral"
        >
          <PanelLeftOpenIcon />
        </Button>
      ) : null}
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
                {item.mobileLabel}
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
  collapsed,
  onCollapse,
}: {
  pathname: string;
  email: string;
  name: string;
  collapsed: boolean;
  onCollapse: () => void;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <aside
      id="app-sidebar"
      data-collapsed={collapsed}
      className={cn(
        "peer fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 motion-reduce:transition-none md:flex",
        collapsed && "-translate-x-full"
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-4 pb-4 pl-5">
        <div className="text-2xl font-semibold tracking-tight">
          IB&nbsp;Studio
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCollapse}
          className="ml-auto text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Ocultar barra lateral"
          aria-controls="app-sidebar"
          aria-expanded={true}
          title="Ocultar barra lateral"
        >
          <PanelLeftCloseIcon />
        </Button>
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
