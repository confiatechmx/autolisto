"use client";

import React from "react";
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRightLeft,
  Lock,
  Unlock,
  Coins,
  Receipt,
  Sparkles,
} from "lucide-react";
import { CajaTurno, CajaFondo } from "@/services/cajaTurnoService";

interface TurnoStatusBarProps {
  turnoActivo: CajaTurno | null;
  fondos: CajaFondo[];
  loading?: boolean;
  onAbrirTurno: () => void;
  onHacerCorte: () => void;
  onTraspaso: () => void;
}

export function TurnoStatusBar({
  turnoActivo,
  fondos,
  loading = false,
  onAbrirTurno,
  onHacerCorte,
  onTraspaso,
}: TurnoStatusBarProps) {
  const fondoOperativo = fondos.find((f) => f.tipo === "OPERATIVO") || fondos[0];
  const fondoReserva = fondos.find((f) => f.tipo === "RESERVA") || fondos[1];

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 animate-pulse flex items-center justify-between">
        <div className="h-4 w-48 bg-slate-200 rounded"></div>
        <div className="h-8 w-32 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  // 1. Estado: SIN TURNO ABIERTO
  if (!turnoActivo) {
    return (
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <Lock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                Caja Cerrada
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Sin turno activo en esta sucursal
              </span>
            </div>
            <h3 className="text-sm md:text-base font-bold text-slate-900 mt-1">
              Es necesario aperturar un turno con arqueo inicial para registrar cobros
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Define los fondos operativos de mostrador y reserva para iniciar la jornada.
            </p>
          </div>
        </div>

        <button
          onClick={onAbrirTurno}
          className="w-full md:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
        >
          <Unlock size={16} />
          Aperturar Turno de Caja
        </button>
      </div>
    );
  }

  // 2. Estado: TURNO ABIERTO ACTIVO
  const fechaApertura = new Date(turnoActivo.fecha_apertura);
  const horaFormateada = fechaApertura.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
      {/* Shift Info & Badges */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute top-0 right-0"></div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                ● Turno en Curso
              </span>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Clock size={12} />
                Abierto a las {horaFormateada}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">
              Corte y Control de Gaveta Activo
            </h3>
          </div>
        </div>

        {/* Separator on desktop */}
        <div className="hidden sm:block h-8 w-px bg-slate-200"></div>

        {/* Dual Funds Status */}
        <div className="flex items-center gap-3 text-xs">
          {/* Fondo 1 */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Fondo 1 (Operativo)
            </span>
            <span className="font-bold text-slate-900 tabular-nums">
              ${Number(fondoOperativo?.saldo_actual || turnoActivo.monto_apertura_fondo1).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Fondo 2 */}
          <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200">
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
              Fondo 2 (Reserva)
            </span>
            <span className="font-bold text-purple-900 tabular-nums">
              ${Number(fondoReserva?.saldo_actual || turnoActivo.monto_apertura_fondo2).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5 w-full xl:w-auto justify-end">
        {/* Traspaso de Fondos */}
        <button
          onClick={onTraspaso}
          title="Traspasar dinero de Reserva (Fondo 2) a Mostrador (Fondo 1)"
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <ArrowRightLeft size={14} />
          <span>Traspaso de Fondos</span>
        </button>

        {/* Corte de Caja / Cierre Ciego */}
        <button
          onClick={onHacerCorte}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
        >
          <Receipt size={14} />
          <span>Hacer Corte de Caja (Cierre Ciego)</span>
        </button>
      </div>
    </div>
  );
}
