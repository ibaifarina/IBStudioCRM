import Link from "next/link";
import { ArrowLeftIcon, MailCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function CheckEmailPage() {
  return (
    <Empty className="border bg-card px-6 py-10 shadow-sm">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MailCheckIcon />
        </EmptyMedia>
        <EmptyTitle>Revisa tu correo</EmptyTitle>
        <EmptyDescription>
          Te hemos enviado un enlace de confirmación. Ábrelo para activar tu
          cuenta y entrar en el CRM.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <p className="text-muted-foreground">
          El correo puede tardar un minuto. Si no aparece, revisa también la
          carpeta de spam.
        </p>
        <Button
          size="lg"
          className="w-full"
          render={<Link href="/login" />}
          nativeButton={false}
        >
          Ir a iniciar sesión
        </Button>
        <Button
          variant="ghost"
          render={<Link href="/registro" />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Usar otro email
        </Button>
      </EmptyContent>
    </Empty>
  );
}
