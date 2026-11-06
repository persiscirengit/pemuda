import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <LoginForm />
    </div>
  );
}
