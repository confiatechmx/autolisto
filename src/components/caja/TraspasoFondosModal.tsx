"use client";

import React, { useState } from "react";
import {
  X,
  ArrowRightLeft,
  Banknote,
  Coins,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { CajaTurnoService, CajaFondo, CajaTurno } from "@/services/cajaTurnoService";

interface TraspasoFondosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  turnoActivo: CajaTurno;
  fondos: CajaFondo[];
  usuarioId: string;
}

const QUICK_AMOUNTS = [500, 1000, 1500, 2000, 3000];

export function TraspasoFondosModal({
  isOpen,
  onClose,
  onSuccess,
  turnoActivo,
  fondos,
  usuarioId,
}: TraspasoFondosModalProps) {
  const fondoOperativo = fondos.find((f) => f.tipo === "OPERATIVO") || fondos[0];
  const fondoReserva = fondos.find((f) => f.tipo === "RESERVA") || fondos[1];

  // Default: Fondo 2 (Reserva) -> Fondo 1 (Operativo)
  const [origenId, setOrigenId] = useState<string>(fondoReserva?.id || "");
  const [destinoId, setDestinoId] = useState<string>(fondoOperativo?.id || "");
  const [monto, setMonto] = useState<string>("1000");
  const [concepto, setConcepto] = useState<string>(
    "Rescate de cambio para mostrador (Fondo 1 sin cambio)"
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const fondoOrigen = fondos.find((f) => f.id === origenId);
  const fondoDestino = fondos.find((f) => f.id === destinoId);

  const saldoOrigen = Number(fondoOrigen?.saldo_actual || 0);
  const saldoDestino = Number(fondoDestino?.saldo_actual || 0);
  const montoNum = Number(monto || 0);

  const handleInvertir = () => {
    setOrigenId(destinoId);
    setDestinoId(origenId);
    if (origenId === fondoReserva?.id) {
      setConcepto("Reabastecimiento de Reserva (Fondo 1 con excedente de efectivo)");
    } else {
      setConcepto("Rescate de cambio para mostrador (Fondo 1 sin cambio)");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isNaN(montoNum) || montoNum <= 0) {
      setErrorMsg("Ingresa un monto válido mayor a 0");
      return;
    }
    if (montoNum > saldoOrigen) {
      setErrorMsg(
        `Saldo insuficiente en ${fondoOrigen?.nombre}. Disponible: $${saldoOrigen.toLocaleString("es-MX")}`
      );
      return;
    }
    if (origenId === destinoId) {
      setErrorMsg("El fondo de origen y destino no pueden ser el mismo");
      return;
    }

    setLoading(true);
    try {
      const res = await CajaTurnoService.traspasoEntreFondos({
        turnoId: turnoActivo.id,
        fondoOrigenId: origenId,
        fondoDestinoId: destinoId,
        monto: montoNum,
        concepto: concepto.trim() || "Traspaso de fondos entre gavetas",
        usuarioId,
      });

      if (!res.success) {
        setErrorMsg(res.error || "No se pudo realizar el traspaso");
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar traspaso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold">Traspaso / Rescate de Fondos</h2>
              <p className="text-xs text-slate-300">
                Movimiento atómico entre Fondo 1 y Fondo 2
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Direction Transfer Graphic */}
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            {/* Origen */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Desde (Origen)
                </span>
                <span className="font-bold text-xs text-slate-900 mt-0.5 block truncate">
                  {fondoOrigen?.nombre || "Fondo Origen"}
                </span>
              </div>
              <div className="mt-2 text-right">
                <span className="text-[11px] text-slate-500">Saldo actual:</span>
                <p className="text-sm font-bold text-slate-900 tabular-nums">
                  ${saldoOrigen.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Invert button */}
            <button
              type="button"
              onClick={handleInvertir}
              title="Invertir dirección del traspaso"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all z-10 hidden md:flex"
            >
              <ArrowRightLeft size={14} />
            </button>

            {/* Destino */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Hacia (Destino)
                </span>
                <span className="font-bold text-xs text-slate-900 mt-0.5 block truncate">
                  {fondoDestino?.nombre || "Fondo Destino"}
                </span>
              </div>
              <div className="mt-2 text-right">
                <span className="text-[11px] text-slate-500">Saldo actual:</span>
                <p className="text-sm font-bold text-emerald-600 tabular-nums">
                  ${saldoDestino.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Amounts */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-700">Monto a Traspasar</label>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setMonto(String(amt))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    Number(monto) === amt
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  ${amt.toLocaleString("es-MX")}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="relative mt-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                $
              </span>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="1000.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-base focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Concepto / Motivo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Concepto / Motivo</label>
            <input
              type="text"
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Rescate de cambio para mostrador"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Summary Preview */}
          {montoNum > 0 && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 text-emerald-950 rounded-xl text-xs flex justify-between items-center">
              <span>Nuevo saldo disponible en destino:</span>
              <span className="font-bold text-emerald-700 tabular-nums">
                ${(saldoDestino + montoNum).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Ejecutando Traspaso...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Confirmar Traspaso
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
