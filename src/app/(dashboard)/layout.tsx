import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { TenantProvider } from "@/context/TenantContext";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!perfil) {
      redirect("/onboarding");
    }
  }

  return (
    <TenantProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 pb-20 md:pb-6">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </TenantProvider>
  );
}
