import { AppSidebar } from "@/components/app-sidebar";
import { GlobalActions } from "@/components/global-actions";
import { getUserDisplayName, requireUser } from "@/lib/auth";
import { getAllTags, getLeadsWithTags } from "@/lib/queries";

export default async function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const [leads, tags] = await Promise.all([
    getLeadsWithTags(),
    getAllTags(),
  ]);

  return (
    <>
      <div className="flex min-h-svh">
        <AppSidebar
          email={user.email ?? ""}
          name={getUserDisplayName(user)}
        />
        <main className="paper-grain min-w-0 flex-1 pt-12 md:ml-[232px] md:pt-0">
          {children}
        </main>
      </div>
      <GlobalActions leads={leads} tags={tags} />
    </>
  );
}
