import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { TenantProvider } from "@/context/TenantContext";
import { DashboardContentWrapper } from "@/components/layout/DashboardContentWrapper";
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
        <DashboardContentWrapper topbar={<Topbar />}>
          {children}
        </DashboardContentWrapper>
      </div>
    </TenantProvider>
  );
}
