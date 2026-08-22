import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDaysIcon,
  KeyRoundIcon,
  LogOutIcon,
  MailIcon,
  SettingsIcon,
  TagsIcon,
  UserRoundIcon,
} from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import {
  EmailUpdateForm,
  PasswordUpdateForm,
  ProfileNameForm,
} from "@/components/account-forms";
import { IconTile } from "@/components/icon-tile";
import { LeadDataTransfer } from "@/components/lead-data-transfer";
import { MapsBookmarkletCard } from "@/components/maps-bookmarklet-card";
import { PageHeader } from "@/components/page-header";
import { TagSettings, type TagSetting } from "@/components/tag-settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserDisplayName, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SettingsCardHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <CardHeader>
      <div className="flex items-start gap-3">
        <IconTile>{icon}</IconTile>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  );
}

function MemberBadge({
  createdAt,
  className,
}: {
  createdAt: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground",
        className
      )}
    >
      <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
      Miembro desde{" "}
      {format(new Date(createdAt), "MMMM 'de' yyyy", { locale: es })}
    </span>
  );
}

export default async function AccountPage() {
  const supabase = await createClient();
  const [user, { data: tagRows, error: tagError }] = await Promise.all([
    requireUser(),
    supabase
      .from("tags")
      .select("id, name, color, lead_tags(count)")
      .order("name", { ascending: true }),
  ]);
  const name = getUserDisplayName(user);
  const email = user.email ?? "";

  if (tagError) {
    throw new Error("No se pudieron cargar los ajustes de etiquetas.", {
      cause: tagError,
    });
  }

  const tags: TagSetting[] = (tagRows ?? []).map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    itemCount: tag.lead_tags[0]?.count ?? 0,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        title="Cuenta"
        subtitle="Gestiona tu perfil, tu seguridad y tus herramientas de trabajo."
      >
        <form action={signOut}>
          <Button type="submit" variant="outline">
            <LogOutIcon data-icon="inline-start" />
            Cerrar sesión
          </Button>
        </form>
      </PageHeader>

      <Tabs
        orientation="vertical"
        defaultValue="perfil"
        className="flex-col gap-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-x-10 [&_[data-slot=tabs-list]]:w-full [&_[data-slot=tabs-list]]:gap-1 [&_[data-slot=tabs-list]]:p-1.5 lg:[&_[data-slot=tabs-list]]:sticky lg:[&_[data-slot=tabs-list]]:top-8 lg:[&_[data-slot=tabs-list]]:self-start [&_[data-slot=tabs-trigger]]:h-9 [&_[data-slot=tabs-trigger]]:px-2.5"
      >
        <TabsList aria-label="Secciones de la cuenta">
          <TabsTrigger value="perfil">
            <UserRoundIcon />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="seguridad">
            <KeyRoundIcon />
            Seguridad
          </TabsTrigger>
          <TabsTrigger value="etiquetas">
            <TagsIcon />
            Etiquetas
            <span className="ml-auto rounded-full bg-foreground/5 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {tags.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="herramientas">
            <SettingsIcon />
            Herramientas
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="perfil"
          className="min-w-0 animate-in fade-in slide-in-from-bottom-2 space-y-4"
        >
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className="flex size-14 shrink-0 select-none items-center justify-center rounded-full bg-brand text-base font-semibold"
                  aria-hidden="true"
                  style={{ color: "oklch(0.985 0 0)" }}
                >
                  {initials(name)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-heading text-lg font-semibold tracking-tight">
                    {name}
                  </h2>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <MailIcon
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{email}</span>
                  </p>
                  {user.created_at && (
                    <MemberBadge
                      createdAt={user.created_at}
                      className="mt-2 sm:hidden"
                    />
                  )}
                </div>
              </div>
              {user.created_at && (
                <MemberBadge
                  createdAt={user.created_at}
                  className="hidden shrink-0 sm:inline-flex"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <SettingsCardHeader
              icon={<UserRoundIcon aria-hidden="true" />}
              title="Nombre"
              description="El nombre que aparece dentro de tu espacio de trabajo."
            />
            <CardContent>
              <ProfileNameForm currentName={name} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="seguridad"
          className="min-w-0 animate-in fade-in slide-in-from-bottom-2 space-y-4"
        >
          <Card>
            <SettingsCardHeader
              icon={<MailIcon aria-hidden="true" />}
              title="Email"
              description="Se usa para iniciar sesión y recuperar tu cuenta."
            />
            <CardContent>
              <EmailUpdateForm currentEmail={email} />
            </CardContent>
          </Card>

          <Card>
            <SettingsCardHeader
              icon={<KeyRoundIcon aria-hidden="true" />}
              title="Contraseña"
              description="Confirma tu contraseña actual antes de establecer una nueva."
            />
            <CardContent>
              <PasswordUpdateForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="etiquetas"
          className="min-w-0 animate-in fade-in slide-in-from-bottom-2"
        >
          <TagSettings tags={tags} />
        </TabsContent>

        <TabsContent
          value="herramientas"
          className="min-w-0 animate-in fade-in slide-in-from-bottom-2 space-y-4"
        >
          <MapsBookmarkletCard />
          <LeadDataTransfer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
