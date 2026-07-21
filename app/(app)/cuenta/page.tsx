import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LogOutIcon } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { AccountForms } from "@/components/account-forms";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserDisplayName, requireUser } from "@/lib/auth";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function AccountPage() {
  const user = await requireUser();
  const name = getUserDisplayName(user);
  const email = user.email ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        title="Cuenta"
        subtitle="Gestiona tu identidad y la seguridad de acceso."
      >
        <form action={signOut}>
          <Button type="submit" variant="outline">
            <LogOutIcon data-icon="inline-start" />
            Cerrar sesión
          </Button>
        </form>
      </PageHeader>

      <Card className="mb-4">
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
            <p className="mt-1 text-xs text-muted-foreground">
              Cuenta creada el {format(new Date(user.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>
        </CardContent>
      </Card>

      <AccountForms currentName={name} currentEmail={email} />
    </div>
  );
}
