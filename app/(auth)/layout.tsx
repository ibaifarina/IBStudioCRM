import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="paper-grain relative flex min-h-svh items-center justify-center px-4 py-12">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/login" className="self-center text-center">
          <span className="block text-2xl font-semibold tracking-tight">
            IB&nbsp;Studio
          </span>
          <span className="mt-1 block text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            CRM
          </span>
        </Link>
        {children}
      </div>
    </main>
  );
}
