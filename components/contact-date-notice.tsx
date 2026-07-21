"use client";

import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CONTACT_DATE_NOTICE_KEY = "crm-hide-contact-date-notice";

export function shouldShowContactDateNotice(): boolean {
  return localStorage.getItem(CONTACT_DATE_NOTICE_KEY) !== "true";
}

export function ContactDateNotice({
  className,
  onDismiss,
}: {
  className?: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-emerald-600/25 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm",
        className
      )}
    >
      <p className="flex items-start gap-1.5">
        <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        La fecha de contacto se actualiza al día en que cambias el estado a
        «Contactado».
      </p>
      <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 pl-5 text-muted-foreground">
        <input
          type="checkbox"
          className="size-3.5 accent-emerald-600"
          onChange={(event) => {
            if (!event.target.checked) return;
            localStorage.setItem(CONTACT_DATE_NOTICE_KEY, "true");
            onDismiss();
          }}
        />
        No volver a mostrar
      </label>
    </div>
  );
}

export function showContactDateNoticeToast() {
  if (!shouldShowContactDateNotice()) return;

  toast.custom(
    (id) => (
      <ContactDateNotice
        className="w-[min(356px,calc(100vw-2rem))] shadow-lg"
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration: 10_000, unstyled: true }
  );
}
