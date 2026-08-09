import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LogOutIcon, SettingsIcon, UserRoundIcon } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { AccountForms } from "@/components/account-forms";
import { LeadDataTransfer } from "@/components/lead-data-transfer";
import { MapsBookmarkletCard } from "@/components/maps-bookmarklet-card";
import { PageHeader } from "@/components/page-header";
import { TagSettings, type TagSetting } from "@/components/tag-settings";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserDisplayName, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
        subtitle="Gestiona tu cuenta y personaliza tu espacio de trabajo."
      >
        <form action={signOut}>
          <Button type="submit" variant="outline">
            <LogOutIcon data-icon="inline-start" />
            Cerrar sesión
          </Button>
        </form>
      </PageHeader>

      <Tabs defaultValue="account" className="gap-4">
        <TabsList aria-label="Secciones de la cuenta">
          <TabsTrigger value="account">
            <UserRoundIcon />
            Cuenta
          </TabsTrigger>
          <TabsTrigger value="settings">
            <SettingsIcon />
            Ajustes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tu espacio de trabajo</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="truncate text-sm text-muted-foreground">{email}</p>
                  {user.created_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cuenta creada el{" "}
                      {format(
                        new Date(user.created_at),
                        "d 'de' MMMM 'de' yyyy",
                        { locale: es }
                      )}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <AccountForms currentName={name} currentEmail={email} />
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <TagSettings tags={tags} />
            </div>
            <MapsBookmarkletCard />
            <LeadDataTransfer />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
