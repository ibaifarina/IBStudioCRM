import { AppSidebar } from "@/components/app-sidebar";
import { GlobalActions } from "@/components/global-actions";
import { getUserDisplayName, requireUser } from "@/lib/auth";
import { getAllTags, getLeadOptions } from "@/lib/queries";

export default async function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, leads, tags] = await Promise.all([
    requireUser(),
    getLeadOptions(),
    getAllTags(),
  ]);

  return (
    <>
      <div className="flex min-h-svh">
        <AppSidebar
          email={user.email ?? ""}
          name={getUserDisplayName(user)}
        />
        <main className="paper-grain min-w-0 flex-1 pt-12 transition-[margin] duration-200 motion-reduce:transition-none md:ml-[232px] md:pt-0 md:peer-data-[collapsed=true]:ml-0">
          {children}
        </main>
      </div>
      <GlobalActions leads={leads} tags={tags} />
    </>
  );
}
