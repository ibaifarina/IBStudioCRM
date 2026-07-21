import Link from "next/link";
import Script from "next/script";
import { ThemeToggle } from "@/components/theme-toggle";

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="paper-grain relative flex min-h-svh items-center justify-center px-4 py-12">
      <Script
        id={TURNSTILE_SCRIPT_ID}
        src={TURNSTILE_SCRIPT_URL}
        strategy="afterInteractive"
      />
      <ThemeToggle
        size="large"
        className="absolute top-5 right-5 sm:top-6 sm:right-6"
      />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/login" className="self-center text-center">
          <span className="block text-2xl font-semibold tracking-tight">
            IB&nbsp;Studio
          </span>
        </Link>
        {children}
      </div>
    </main>
  );
}
