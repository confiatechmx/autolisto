"use client";

import React from "react";
import { AlertOctagon, MessageCircle, LogOut, ShieldAlert } from "lucide-react";
import { EmpresaConfig } from "@/context/TenantContext";
import { createClient } from "@/lib/supabase/client";

interface SuspendedTenantViewProps {
  empresa: EmpresaConfig;
  onLogout?: () => void;
}

export default function SuspendedTenantView({ empresa, onLogout }: SuspendedTenantViewProps) {
  const companyName = empresa.nombre_comercial || "Taller Automotriz";
  const supportWhatsapp = "528123456789"; // Soporte oficial AutoListo
  const whatsappUrl = `https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
    `Hola equipo de AutoListo, me comunico sobre la reactivación de cuenta para mi taller "${companyName}" (ID: ${empresa.id}).`
  )}`;

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-foreground relative overflow-hidden select-none">
      {/* Background ambient glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative z-10 text-center space-y-6">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <AlertOctagon className="h-8 w-8 animate-bounce" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            Suscripción Suspendida
          </span>
          <h2 className="text-xl font-black text-white">
            Acceso en Pausa Temporal
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            El espacio de trabajo de <strong className="text-white">{companyName}</strong> se encuentra pausado por conciliación de pago pendiente o revisión administrativa.
          </p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Tus datos de taller están 100% seguros</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Todas tus órdenes de trabajo, clientes, vehículos, inspecciones DVI e inventario de refacciones y llantas continúan intactos y protegidos.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Contactar a Soporte AutoListo por WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 px-4 text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
