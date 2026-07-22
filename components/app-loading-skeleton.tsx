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
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-[1.4fr_.8fr_.8fr_.5fr] gap-4 border-b px-4 py-3">
          {TABLE_ROWS.slice(0, 4).map((cell) => (
            <Skeleton key={cell} className="h-3 w-20 max-w-full" />
          ))}
        </div>
        {TABLE_ROWS.map((row) => (
          <div
            key={row}
            className="grid grid-cols-[1.4fr_.8fr_.8fr_.5fr] gap-4 border-b px-4 py-4 last:border-b-0"
          >
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-4 w-20 max-w-full" />
            <Skeleton className="h-5 w-24 max-w-full rounded-full" />
            <Skeleton className="h-4 w-12 max-w-full" />
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

export function AccountLoadingSkeleton() {
  return (
    <LoadingRegion className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeaderSkeleton action />
      <div className="mb-4 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {TABLE_ROWS.slice(0, 2).map((card) => (
          <div key={card} className="rounded-xl border bg-card p-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            <Skeleton className="mt-7 h-4 w-16" />
            <Skeleton className="mt-2 h-9 w-full" />
            <Skeleton className="mt-5 h-9 w-28" />
          </div>
        ))}
        <div className="rounded-xl border bg-card p-6 lg:col-span-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-2 h-3 w-80 max-w-full" />
          <div className="mt-7 max-w-md space-y-4">
            {TABLE_ROWS.slice(0, 3).map((field) => (
              <div key={field}>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
