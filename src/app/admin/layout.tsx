import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { PreviewModeProvider } from "@/components/admin/PreviewModeProvider";
import { PreviewModeBanner } from "@/components/admin/PreviewModeBanner";
import { getAdminUser } from "@/lib/admin-auth";
import { createSupabaseServer } from "@/lib/supabase-server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = headers().get("x-pathname") ?? "";

  // /admin/login and /admin/reset-password render without sidebar + auth check
  if (pathname === "/admin/login" || pathname === "/admin/reset-password") {
    return <>{children}</>;
  }

  const adminUser = await getAdminUser();
  if (!adminUser) {
    // Distinguish "no session" from "signed in but not on the admin allowlist" —
    // a silent redirect on the latter looks like a login failure to the user.
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect(
        "/admin/login?error=" +
          encodeURIComponent(
            "This account isn't on the admin allowlist. Contact Dennis to be added.",
          ),
      );
    }
    redirect("/admin/login");
  }

  return (
    <PreviewModeProvider>
      <div className="flex min-h-screen bg-gray-50 text-gray-900">
        <AdminSidebar email={adminUser.email} />
        <div className="flex-1 flex flex-col">
          <PreviewModeBanner />
          <header className="bg-white border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-slate-900">
                Factory2Key Projects — Administration
              </h1>
              <span className="text-xs text-slate-500">
                {adminUser.role.replace("_", " ")}
              </span>
            </div>
          </header>
          <main className="p-6 flex-1">{children}</main>
        </div>
      </div>
    </PreviewModeProvider>
  );
}
