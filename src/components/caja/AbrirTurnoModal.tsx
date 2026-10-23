"use client";

import React, { useState } from "react";
import {
  X,
  Unlock,
  Banknote,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Coins,
} from "lucide-react";
import { CajaTurnoService, CajaFondo } from "@/services/cajaTurnoService";

interface AbrirTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  empresaId: string;
  sucursalId: string;
  usuarioId: string;
  fondos: CajaFondo[];
}

export function AbrirTurnoModal({
  isOpen,
  onClose,
  onSuccess,
  empresaId,
  sucursalId,
  usuarioId,
  fondos,
}: AbrirTurnoModalProps) {
  const fondoOperativo = fondos.find((f) => f.tipo === "OPERATIVO") || fondos[0];
  const fondoReserva = fondos.find((f) => f.tipo === "RESERVA") || fondos[1];

  const [montoF1, setMontoF1] = useState<string>(
    fondoOperativo?.saldo_actual ? String(fondoOperativo.saldo_actual) : "1500"
  );
  const [montoF2, setMontoF2] = useState<string>(
    fondoReserva?.saldo_actual ? String(fondoReserva.saldo_actual) : "8000"
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const valF1 = Number(montoF1);
    const valF2 = Number(montoF2);

    if (isNaN(valF1) || valF1 < 0) {
      setErrorMsg("El monto de Fondo 1 debe ser un número válido");
      return;
    }
    if (isNaN(valF2) || valF2 < 0) {
      setErrorMsg("El monto de Fondo 2 debe ser un número válido");
      return;
    }

    setLoading(true);
    try {
      const res = await CajaTurnoService.abrirTurno({
        empresaId,
        sucursalId,
        usuarioId,
        montoFondo1: valF1,
        montoFondo2: valF2,
      });

      if (!res.success) {
        setErrorMsg(res.error || "No se pudo aperturar el turno");
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar apertura");
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
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
              <Unlock size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold">Apertura de Turno de Caja</h2>
              <p className="text-xs text-slate-300">
                Arqueo inicial de fondos para comenzar a cobrar
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fondo 1: Mostrador Operativo */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote size={16} className="text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Fondo 1: Operativo (Mostrador)
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Caja Chica Diaria
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Efectivo disponible en la gaveta física para dar cambio a clientes y gastos menores.
            </p>
            <div className="relative mt-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                $
              </span>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={montoF1}
                onChange={(e) => setMontoF1(e.target.value)}
                placeholder="1500.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-base focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Fondo 2: Reserva Taller */}
          <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-purple-600" />
                <span className="text-xs font-bold text-purple-950">
                  Fondo 2: Reserva (Caja Fuerte / Resguardo)
                </span>
              </div>
              <span className="text-[10px] font-bold text-purple-600 uppercase">
                Fondo de Emergencia
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Fondo secundario en resguardo del que se traspasará cambio solo si se agota Fondo 1.
            </p>
            <div className="relative mt-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-purple-400 text-sm">
                $
              </span>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={montoF2}
                onChange={(e) => setMontoF2(e.target.value)}
                placeholder="8000.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-purple-200 rounded-xl text-slate-900 font-bold text-base focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>
          </div>

          {/* Total Opening Float */}
          <div className="flex items-center justify-between px-2 text-xs font-medium text-slate-600">
            <span>Total Inicial Físico en Taller:</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              ${(Number(montoF1 || 0) + Number(montoF2 || 0)).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
            </span>
          </div>

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
                  Aperturando Turno...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Confirmar y Abrir Turno
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
