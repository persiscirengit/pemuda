import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { auth } from "@/lib/auth";
import { getUserPermissions } from "@/server/dal/auth";

export default async function ProfilePage() {
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

  return (
    <div className="space-y-6">
      <ProfileForm user={user} permissions={permissions} />
    </div>
  );
}
