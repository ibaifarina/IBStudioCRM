import { Skeleton } from "@/components/ui/skeleton";

const TABLE_ROWS = Array.from({ length: 7 }, (_, index) => index);
const STATUS_FILTERS = Array.from({ length: 5 }, (_, index) => index);

function LoadingRegion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando contenido"
      className={className}
    >
      <span className="sr-only">Cargando contenido…</span>
      {children}
    </div>
  );
}

function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-72 max-w-[70vw]" />
      </div>
      {action ? <Skeleton className="hidden h-9 w-28 sm:block" /> : null}
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <LoadingRegion className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TABLE_ROWS.slice(0, 4).map((card) => (
          <div key={card} className="rounded-xl border bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-9 w-16" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {TABLE_ROWS.slice(0, 4).map((panel) => (
          <div key={panel} className="rounded-xl border bg-card p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-6 h-44 w-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function LeadsLoadingSkeleton() {
  return (
    <LoadingRegion className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeaderSkeleton />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-6 border-b px-5 py-2.5">
          {TABLE_ROWS.slice(0, 4).map((cell) => (
            <Skeleton key={cell} className="h-2.5 w-16 max-w-full" />
          ))}
          <Skeleton className="ml-auto h-2.5 w-10" />
        </div>
        {TABLE_ROWS.map((row) => (
          <div
            key={row}
            className="flex items-center gap-6 border-b px-5 py-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-36 max-w-full" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </div>
            </div>
            <Skeleton className="hidden h-5 w-16 shrink-0 rounded-full lg:block" />
            <Skeleton className="hidden size-7 shrink-0 rounded-lg md:block" />
            <Skeleton className="hidden h-4 w-28 shrink-0 xl:block" />
            <Skeleton className="h-5 w-28 shrink-0 rounded-full" />
            <Skeleton className="hidden h-3 w-12 shrink-0 sm:block" />
            <Skeleton className="h-3 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function MapLoadingSkeleton() {
  return (
    <LoadingRegion className="mx-auto flex h-[calc(100svh-3rem)] max-w-6xl flex-col px-4 py-8 md:h-svh md:px-8">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((filter) => (
          <Skeleton key={filter} className="h-7 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-3 min-h-80 flex-1 rounded-xl" />
    </LoadingRegion>
  );
}

export function TemplatesLoadingSkeleton() {
  return (
    <LoadingRegion className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeaderSkeleton action />
      <div className="grid min-h-[680px] overflow-hidden rounded-2xl border bg-card shadow-xs lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b lg:border-r lg:border-b-0">
          <div className="p-3">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
          <div className="space-y-1 p-2">
            {TABLE_ROWS.map((row) => (
              <div key={row} className="rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-5 shrink-0 rounded-md" />
                  <Skeleton className="h-4 w-32 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </aside>
        <main className="mx-auto hidden max-w-3xl flex-1 p-8 sm:block">
          <div className="flex items-start gap-4 border-b pb-6">
            <Skeleton className="size-6 shrink-0" />
            <Skeleton className="h-7 flex-1 max-w-56" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="mt-8 space-y-6">
            {TABLE_ROWS.slice(0, 3).map((field) => (
              <div key={field}>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-10 w-full rounded-lg" />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Skeleton className="h-10 w-36 rounded-lg" />
              <Skeleton className="h-10 w-24 rounded-lg" />
            </div>
          </div>
        </main>
      </div>
    </LoadingRegion>
  );
}

export function AccountLoadingSkeleton() {
  return (
    <LoadingRegion className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeaderSkeleton action />
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-x-10">
        <div
          role="presentation"
          className="h-fit space-y-1 rounded-xl border bg-card p-1.5"
        >
          {TABLE_ROWS.slice(0, 4).map((item) => (
            <div key={item} className="flex items-center gap-2 px-2.5 py-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-full" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="h-3.5 w-56 max-w-full" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            </div>
            <Skeleton className="mt-6 h-9 w-full" />
            <Skeleton className="mt-5 h-8 w-28" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
