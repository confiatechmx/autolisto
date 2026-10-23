"use client";

import React, { useState } from "react";
import { X, DollarSign, Calendar, CreditCard, ShieldCheck, Loader2 } from "lucide-react";
import { EmpresaHqRecord, saasHqService } from "@/services/saasHqService";
import { toast } from "sonner";

interface ConciliarPagoModalProps {
  empresa: EmpresaHqRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PLAN_PRICES: Record<string, number> = {
  STARTER: 1499,
  PRO: 3999,
  ENTERPRISE: 9999,
};

export default function ConciliarPagoModal({ empresa, isOpen, onClose, onSuccess }: ConciliarPagoModalProps) {
  if (!isOpen || !empresa) return null;

  const initialPlan =
    empresa.plan_suscripcion === "PRO" || empresa.plan_suscripcion === "ENTERPRISE"
      ? empresa.plan_suscripcion
      : "STARTER";

  const [selectedPlan, setSelectedPlan] = useState<"STARTER" | "PRO" | "ENTERPRISE">(initialPlan);
  const [meses, setMeses] = useState<number>(1);
  const [monto, setMonto] = useState<number>(PLAN_PRICES[initialPlan] || 1499);
  const [metodoPago, setMetodoPago] = useState<string>("TRANSFERENCIA_SPEI");
  const [referencia, setReferencia] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handlePlanChange = (newPlan: "STARTER" | "PRO" | "ENTERPRISE") => {
    setSelectedPlan(newPlan);
    const base = PLAN_PRICES[newPlan] || 1499;
    const total = meses === 12 ? base * 10 : base * meses;
    setMonto(total);
  };

  const handleMesesChange = (newMeses: number) => {
    setMeses(newMeses);
    const base = PLAN_PRICES[selectedPlan] || 1499;
    const total = newMeses === 12 ? base * 10 : base * newMeses;
    setMonto(total);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referencia.trim() && metodoPago !== "CORTESIA_COMERCIAL") {
      toast.error("Por favor ingresa la referencia SPEI o comprobante de pago.");
      return;
    }

    try {
      setLoading(true);
      await saasHqService.registrarPagoConciliacion({
        empresaId: empresa.id,
        plan_suscripcion: selectedPlan,
        mesesVigencia: meses,
        monto: Number(monto),
        referencia: referencia.trim() || "CORTESIA",
        metodoPago,
        notas: notas.trim(),
      });

      toast.success("¡Pago conciliado y suscripción activada!", {
        description: `${empresa.nombre_comercial} activado en Plan ${selectedPlan} por ${meses} mes(es).`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Error al registrar la conciliación: " + (err.message || "Verifica los datos"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Conciliación Manual de Pago</h3>
              <p className="text-xs text-slate-400">Renovación de suscripción para {empresa.nombre_comercial}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Plan Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
              Plan de Suscripción SaaS
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["STARTER", "PRO", "ENTERPRISE"] as const).map((p) => {
                const isSelected = selectedPlan === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePlanChange(p)}
                    className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-600/20 border-blue-500 text-blue-300 font-bold shadow-xs"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold">{p}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">${PLAN_PRICES[p]?.toLocaleString()}/mes</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Periodo de Vigencia */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
              Tiempo a Extender
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { m: 1, label: "1 Mes" },
                { m: 3, label: "3 Meses" },
                { m: 6, label: "6 Meses" },
                { m: 12, label: "1 Año (-17%)" },
              ].map(({ m, label }) => {
                const isSelected = meses === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMesesChange(m)}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monto y Método de Pago */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Monto Cobrado (MXN)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Método de Pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="TRANSFERENCIA_SPEI">Transferencia SPEI</option>
                <option value="TARJETA_STRIPE">Stripe / Tarjeta</option>
                <option value="EFECTIVO_CAJA">Efectivo / Caja Chica</option>
                <option value="CORTESIA_COMERCIAL">Cortesía Comercial (Demo)</option>
              </select>
            </div>
          </div>

          {/* Referencia */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Referencia Bancaria / Clave de Rastreo SPEI
            </label>
            <input
              type="text"
              placeholder="Ej. SPEI-BBVA-908123 o Folio de Recibo"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>

          {/* Notas Internas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Notas Administrativas (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Acordado con el dueño del taller por WhatsApp"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>Registrar y Activar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
