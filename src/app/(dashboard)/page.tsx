import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  const tShell = await getTranslations("shell");
  const tNav = await getTranslations("navigation");
  const userName = session?.user?.name ?? "";
  const welcomeTitle = tShell("welcomeBack", { name: userName });
  const initialCount = 0;
  const initialBalance = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={welcomeTitle}
        description={tShell("dashboardSubtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{tNav("activities")}</CardTitle>
            <CardDescription>{tNav("activitiesList")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{initialCount}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{tNav("members")}</CardTitle>
            <CardDescription>{tNav("members")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{initialCount}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{tNav("finance")}</CardTitle>
            <CardDescription>{tNav("financialLedger")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{initialBalance}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
