"use client";

import React from "react";
import { useTenant } from "@/context/TenantContext";
import ImpersonationBanner from "@/components/hq/ImpersonationBanner";
import SuspendedTenantView from "@/components/hq/SuspendedTenantView";

export function DashboardContentWrapper({
  topbar,
  children,
}: {
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const { empresa, impersonation } = useTenant();

  // Si la empresa fue suspendida mediante el Kill-Switch de HQ y no hay soporte activo
  if (empresa && empresa.activo === false && !impersonation) {
    return <SuspendedTenantView empresa={empresa} />;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {impersonation && <ImpersonationBanner impersonation={impersonation} />}
      {topbar}
      <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 pb-20 md:pb-6">
        {children}
      </main>
    </div>
  );
}
