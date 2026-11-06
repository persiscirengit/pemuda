import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/shell/components/app-sidebar";
import { auth } from "@/lib/auth";
import { getUserPermissions } from "@/server/dal/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  const user = session.user as typeof session.user & {
    memberId?: string | null;
    username?: string | null;
  };
  const hasMemberLink = !!user.memberId;
  const t = await getTranslations("common");

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        permissions={permissions}
        hasMemberLink={hasMemberLink}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium text-muted-foreground">
            {t("organizationName")}
          </span>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
