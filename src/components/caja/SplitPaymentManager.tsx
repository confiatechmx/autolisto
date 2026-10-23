"use client";

import React from "react";
import {
  Plus,
  Trash2,
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Coins,
  Split,
} from "lucide-react";
import { MetodoPagoTipo, PaymentSplitItem } from "@/services/multiPaymentService";

interface SplitPaymentManagerProps {
  total: number;
  payments: PaymentSplitItem[];
  onChange: (payments: PaymentSplitItem[]) => void;
  disabled?: boolean;
}

const METODO_OPTIONS: Array<{
  value: MetodoPagoTipo;
  label: string;
  icon: any;
  color: string;
}> = [
  { value: "Efectivo", label: "Efectivo", icon: Banknote, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "Tarjeta", label: "Tarjeta / TPV", icon: CreditCard, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "Transferencia", label: "SPEI (Transferencia)", icon: Landmark, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "KueskiPay", label: "KueskiPay (BNPL)", icon: Smartphone, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "Atrato", label: "Atrato Pago", icon: Smartphone, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { value: "Mercado Pago", label: "Mercado Pago", icon: CreditCard, color: "text-sky-600 bg-sky-50 border-sky-200" },
];

export function SplitPaymentManager({
  total,
  payments,
  onChange,
  disabled = false,
}: SplitPaymentManagerProps) {
  // Sum of assigned amounts
  const totalCubierto = payments.reduce((acc, p) => acc + Number(p.monto || 0), 0);
  const restante = Math.max(0, total - totalCubierto);
  const sobrepago = Math.max(0, totalCubierto - total);
  const estaCompleto = Math.abs(totalCubierto - total) < 0.05;

  // Total cash change
  const cambioTotalEfectivo = payments
    .filter((p) => p.metodo === "Efectivo")
    .reduce((acc, p) => acc + Number(p.cambio || 0), 0);

  const handleAddPayment = (metodo: MetodoPagoTipo = "Efectivo") => {
    const nextAmount = restante > 0 ? restante : 0;
    const newItem: PaymentSplitItem = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      metodo,
      monto: Number(nextAmount.toFixed(2)),
      montoRecibido: metodo === "Efectivo" ? Number(nextAmount.toFixed(2)) : undefined,
      cambio: 0,
      referencia: "",
      detalle: "",
    };
    onChange([...payments, newItem]);
  };

  const handleRemovePayment = (id: string) => {
    if (payments.length <= 1) return;
    onChange(payments.filter((p) => p.id !== id));
  };

  const handleUpdatePayment = (id: string, updates: Partial<PaymentSplitItem>) => {
    onChange(
      payments.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, ...updates };

        // Recalculate cash change if applicable
        if (updated.metodo === "Efectivo") {
          const recibido = Number(updated.montoRecibido || 0);
          const monto = Number(updated.monto || 0);
          updated.cambio = recibido > monto ? Number((recibido - monto).toFixed(2)) : 0;
        }
        return updated;
      })
    );
  };

  const handleSplitEqually = (divisions: number) => {
    if (divisions < 2) return;
    const part = Number((total / divisions).toFixed(2));
    const newPayments: PaymentSplitItem[] = [];

    for (let i = 0; i < divisions; i++) {
      // Adjust last item to absorb penny rounding difference
      const isLast = i === divisions - 1;
      const amount = isLast
        ? Number((total - part * (divisions - 1)).toFixed(2))
        : part;

      const metodo: MetodoPagoTipo = i === 0 ? "Efectivo" : "Tarjeta";
      newPayments.push({
        id: `split-${i}-${Date.now()}`,
        metodo,
        monto: amount,
        montoRecibido: metodo === "Efectivo" ? amount : undefined,
        cambio: 0,
        referencia: "",
        detalle: "",
      });
    }
    onChange(newPayments);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Quick split actions toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
          <Split className="w-3.5 h-3.5 text-slate-500" />
          Métodos de Pago ({payments.length})
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSplitEqually(2)}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded border border-slate-300 transition-colors cursor-pointer"
          >
            Dividir en 2
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSplitEqually(3)}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded border border-slate-300 transition-colors cursor-pointer"
          >
            Dividir en 3
          </button>
        </div>
      </div>

      {/* Payment Splits List */}
      <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
        {payments.map((p, index) => {
          const isCash = p.metodo === "Efectivo";
          const isCard = p.metodo === "Tarjeta" || p.metodo === "Mercado Pago";
          const isTransfer = p.metodo === "Transferencia";
          const isBNPL = p.metodo === "KueskiPay" || p.metodo === "Atrato";

          return (
            <div
              key={p.id}
              className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2 transition-all shadow-xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 font-mono w-4">
                  #{index + 1}
                </span>

                {/* Method selector */}
                <select
                  disabled={disabled}
                  value={p.metodo}
                  onChange={(e) => {
                    const newMetodo = e.target.value as MetodoPagoTipo;
                    handleUpdatePayment(p.id, {
                      metodo: newMetodo,
                      montoRecibido: newMetodo === "Efectivo" ? p.monto : undefined,
                      cambio: 0,
                    });
                  }}
                  className="flex-1 h-9 bg-white border border-slate-300 rounded-md px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                >
                  {METODO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Amount input */}
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={disabled}
                    value={p.monto === 0 ? "" : p.monto}
                    placeholder="0.00"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      handleUpdatePayment(p.id, {
                        monto: val,
                        montoRecibido: isCash ? (p.montoRecibido && p.montoRecibido >= val ? p.montoRecibido : val) : undefined,
                      });
                    }}
                    className="w-full h-9 pl-6 pr-2 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-primary shadow-xs tabular-nums"
                  />
                </div>

                {/* Delete line button */}
                {payments.length > 1 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemovePayment(p.id)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 transition-colors cursor-pointer rounded hover:bg-rose-50"
                    title="Eliminar este método de pago"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Conditional Extra Fields for Cash, Card, or SPEI */}
              {isCash && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Efectivo Entregado
                    </span>
                    <div className="relative mt-0.5">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        $
                      </span>
                      <input
                        type="number"
                        min={p.monto}
                        step="0.01"
                        disabled={disabled}
                        value={p.montoRecibido ?? p.monto}
                        onChange={(e) =>
                          handleUpdatePayment(p.id, {
                            montoRecibido: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full h-8 pl-5 pr-2 bg-white border border-slate-200 rounded text-xs text-slate-800 text-right font-medium tabular-nums shadow-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Cambio a Devolver
                    </span>
                    <div className="h-8 mt-0.5 px-2 bg-slate-100 rounded border border-slate-200 flex items-center justify-end font-bold text-xs text-slate-900 tabular-nums">
                      ${Number(p.cambio || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}

              {(isCard || isTransfer || isBNPL) && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      {isCard ? "Terminal / Banco" : isTransfer ? "Banco Emisor / SPEI" : "Plataforma"}
                    </span>
                    <input
                      type="text"
                      disabled={disabled}
                      placeholder={isCard ? "Ej. Clip, Santander Débito" : isTransfer ? "Ej. BBVA Transfer" : "Kueski"}
                      value={p.detalle || ""}
                      onChange={(e) => handleUpdatePayment(p.id, { detalle: e.target.value })}
                      className="w-full h-8 mt-0.5 px-2 bg-white border border-slate-200 rounded text-xs text-slate-800 shadow-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Ref. / Autorización / Voucher
                    </span>
                    <input
                      type="text"
                      disabled={disabled}
                      placeholder="Ej. AUTH-84920"
                      value={p.referencia || ""}
                      onChange={(e) => handleUpdatePayment(p.id, { referencia: e.target.value })}
                      className="w-full h-8 mt-0.5 px-2 bg-white border border-slate-200 rounded text-xs text-slate-800 shadow-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Button to add another split payment line */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleAddPayment(restante > 0 ? "Tarjeta" : "Efectivo")}
        className="w-full py-2 bg-white hover:bg-slate-50 text-primary border border-dashed border-primary/40 hover:border-primary rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Agregar Otro Método de Pago</span>
        {restante > 0 && (
          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] ml-1">
            (Resta ${restante.toLocaleString("es-MX", { minimumFractionDigits: 2 })})
          </span>
        )}
      </button>

      {/* Financial Summary & Balance Validation Banner */}
      <div className="bg-slate-100/90 border border-slate-200 rounded-lg p-3 text-xs flex flex-col gap-1.5 shadow-inner">
        <div className="flex justify-between items-center text-slate-600">
          <span>Total Venta / Orden:</span>
          <span className="font-bold text-slate-900 tabular-nums">
            ${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-600">
          <span>Total Métodos Asignados:</span>
          <span className="font-bold text-slate-900 tabular-nums">
            ${totalCubierto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {cambioTotalEfectivo > 0 && (
          <div className="flex justify-between items-center text-emerald-700 font-semibold border-t border-slate-200/80 pt-1">
            <span className="flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" /> Cambio en Efectivo:
            </span>
            <span className="tabular-nums">
              ${cambioTotalEfectivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Validation Status */}
        <div className="border-t border-slate-200 pt-1.5 mt-0.5">
          {estaCompleto ? (
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Monto 100% cubierto. Listo para registrar.</span>
            </div>
          ) : restante > 0 ? (
            <div className="flex items-center justify-between text-amber-700 font-bold">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Falta por cubrir:
              </span>
              <span className="tabular-nums text-sm">
                ${restante.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-rose-700 font-bold">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                Sobrepago asignado:
              </span>
              <span className="tabular-nums text-sm">
                +${sobrepago.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
