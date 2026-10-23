"use client";

import React, { useState } from "react";
import { ShieldCheck, LogOut, Loader2 } from "lucide-react";
import { saasHqService, ImpersonationSession } from "@/services/saasHqService";
import { toast } from "sonner";

interface ImpersonationBannerProps {
  impersonation: ImpersonationSession;
  onExit?: () => void;
}

export default function ImpersonationBanner({ impersonation, onExit }: ImpersonationBannerProps) {
  const [loading, setLoading] = useState(false);

  const handleExit = async () => {
    try {
      setLoading(true);
      await saasHqService.finalizarImpersonacion();
      toast.success("Sesión de soporte finalizada", {
        description: "Has vuelto a tu cuenta administrativa de SuperAdmin.",
      });
      if (onExit) onExit();
    } catch (e: any) {
      toast.error("Error al salir de soporte: " + (e.message || "Inténtalo de nuevo"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-[#0B1120] text-slate-100 px-4 py-2 shadow-md flex flex-wrap items-center justify-between gap-3 border-b border-blue-500/40 animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2.5 text-xs sm:text-sm">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 border border-blue-500/35 text-blue-300 tracking-wide uppercase shadow-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
          <span>Modo Soporte HQ</span>
        </span>
        <div className="flex items-center gap-1.5 flex-wrap text-xs sm:text-[13px]">
          <span className="text-slate-300 font-medium">Taller Activo:</span>
          <span className="font-bold text-white bg-slate-800/90 px-2.5 py-0.5 rounded-md border border-blue-500/25 shadow-xs">
            {impersonation.targetEmpresaNombre}
          </span>
          <span className="hidden md:inline text-slate-400 text-xs">
            (Operado por <strong className="text-slate-300 font-semibold">{impersonation.originalSuperAdminNombre || impersonation.originalSuperAdminEmail}</strong>)
          </span>
        </div>
      </div>

      <button
        onClick={handleExit}
        disabled={loading}
        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm hover:shadow-blue-500/25 border border-blue-400/20 cursor-pointer disabled:opacity-50"
        title="Finalizar sesión de impersonación y regresar a AutoListo HQ"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <LogOut className="h-3.5 w-3.5 text-white" />}
        <span>Finalizar Soporte</span>
      </button>
    </div>
  );
}
