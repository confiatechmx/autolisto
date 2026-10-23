"use client";

import React, { useRef } from "react";
import {
  Printer,
  X,
  MessageCircle,
  CheckCircle2,
  Car,
  User,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard,
  Banknote,
  Receipt,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  payment?: any;
  empresa: any;
  sucursal?: any;
  cashGiven?: number;
  changeDue?: number;
}

export function ReceiptModal({
  isOpen,
  onClose,
  order,
  payment,
  empresa,
  sucursal,
  cashGiven,
  changeDue,
}: ReceiptModalProps) {
  if (!isOpen || !order) return null;

  const veh = order.vehiculos || {};
  const cli = veh.clientes || {};
  const folioDisplay = `#${1000 + Number(order.folio || 1)}`;
  const ticketFolio = `TCK-${order.folio ? 1000 + Number(order.folio) : order.id.slice(0, 4).toUpperCase()}`;
  const nowStr = new Date().toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const servicios = (order.orden_servicio_servicios || []).filter(
    (s: any) => s.estatus_aprobacion !== "Diferido"
  );
  const refacciones = (order.orden_servicio_refacciones || []).filter(
    (r: any) => r.estatus_aprobacion !== "Diferido"
  );
  const cotList = Array.isArray(order.cotizaciones)
    ? order.cotizaciones
    : order.cotizaciones
    ? [order.cotizaciones]
    : [];
  const llantas = cotList
    .flatMap((c: any) => c.detalles_cotizacion || [])
    .filter((l: any) => l.estatus_aprobacion !== "Diferido");

  const total = Number(order.granTotal || 0);
  const pagado = Number(order.pagado || 0);
  const saldo = Number(order.saldo || 0);
  const tasaIva = Number(empresa?.tasa_iva ?? 16);
  const subtotalSinIva = total / (1 + tasaIva / 100);
  const iva = total - subtotalSinIva;

  // Build clean WhatsApp message
  const rawPhone = cli.telefono || "";
  const cleanPhone = rawPhone.replace(/\D/g, "");
  const waPhone = cleanPhone.startsWith("52") ? cleanPhone : `52${cleanPhone}`;
  const waMessage = encodeURIComponent(
    `🧾 *COMPROBANTE DE PAGO / TICKET DE CAJA*\n` +
      `🏢 *${empresa?.nombre_comercial || "Torque & Ruta - Centro Automotriz"}*\n` +
      `🔖 Ticket: ${ticketFolio} | Orden: ${folioDisplay}\n` +
      `🚗 ${veh.marca || ""} ${veh.modelo || ""} (${veh.placas || "Sin placas"})\n` +
      `👤 Cliente: ${cli.nombre || "Venta General"}\n` +
      `--------------------------------\n` +
      `💳 Método: ${payment?.metodo_detalle || payment?.proveedor_pago || "Efectivo"}\n` +
      `💰 Monto Cobrado: $${Number(payment?.monto_total || total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n` +
      (cashGiven ? `💵 Efectivo Recibido: $${cashGiven.toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n` : "") +
      (changeDue ? `🪙 Cambio Entregado: $${changeDue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n` : "") +
      `🏁 Saldo Pendiente: $${saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n` +
      `--------------------------------\n` +
      `✅ ¡Gracias por tu confianza! Póliza de garantía: 30 días o 1,000 km.`
  );
  const whatsappUrl = `https://wa.me/${waPhone}?text=${waMessage}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Comprobante de Caja / Ticket Térmico" size="md">
      <div className="flex flex-col gap-4">
        {/* Printable Ticket Preview (Styled as 80mm POS receipt) */}
        <div
          id="pos-thermal-ticket"
          className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-5 font-mono text-xs text-slate-800 shadow-inner flex flex-col gap-3"
        >
          {/* Header */}
          <div className="text-center border-b border-slate-200 pb-3">
            <h2 className="font-bold text-sm tracking-tight text-slate-900 uppercase">
              {empresa?.nombre_comercial || "Torque & Ruta - Centro Automotriz"}
            </h2>
            {empresa?.eslogan && <p className="text-[10px] text-slate-500">{empresa.eslogan}</p>}
            <p className="text-[10px] text-slate-600 mt-0.5">
              RFC: {empresa?.rfc || "TRC2105148A1"}
            </p>
            <p className="text-[10px] text-slate-500">
              {sucursal?.nombre ? `Sucursal: ${sucursal.nombre}` : ""} • {sucursal?.telefono || empresa?.telefono || ""}
            </p>
            <p className="text-[10px] text-slate-400 truncate max-w-xs mx-auto">
              {sucursal?.direccion || empresa?.direccion || ""}
            </p>
          </div>

          {/* Ticket Metadata */}
          <div className="flex justify-between items-center text-[11px] border-b border-slate-200 pb-2">
            <div>
              <span className="font-bold text-slate-900">{ticketFolio}</span>
              <p className="text-[10px] text-slate-500">Orden: {folioDisplay}</p>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              <p>{nowStr}</p>
              <p>Caja: Ventanilla Principal</p>
            </div>
          </div>

          {/* Customer & Vehicle Info */}
          <div className="bg-slate-50 rounded p-2 text-[11px] flex flex-col gap-0.5 border border-slate-100">
            <p className="font-bold text-slate-900">{cli.nombre || "Venta de Mostrador"}</p>
            <p className="text-slate-600">
              Auto: {veh.marca} {veh.modelo} {veh.anio || ""} • Placas:{" "}
              <span className="font-bold">{veh.placas || "N/A"}</span>
            </p>
            {veh.kilometraje_actual && (
              <p className="text-slate-500">KM: {veh.kilometraje_actual.toLocaleString("es-MX")} km</p>
            )}
          </div>

          {/* Line Items List */}
          <div className="border-b border-slate-200 pb-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <span>Concepto</span>
              <span>Importe</span>
            </div>
            <div className="flex flex-col gap-1 text-[11px]">
              {servicios.map((s: any) => (
                <div key={s.id} className="flex justify-between">
                  <span className="truncate pr-2">
                    {s.servicios_taller?.nombre || "Mano de Obra"} ({s.horas_labor || 1}h)
                  </span>
                  <span className="font-bold shrink-0">
                    ${Number(s.precio_cobrado || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              {refacciones.map((r: any) => (
                <div key={r.id} className="flex justify-between text-slate-700">
                  <span className="truncate pr-2">
                    {r.nombre} x{r.cantidad}
                  </span>
                  <span className="font-bold shrink-0">
                    ${Number(r.subtotal || r.precio_unitario * r.cantidad || 0).toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
              {llantas.map((l: any) => (
                <div key={l.id} className="flex justify-between text-slate-700">
                  <span className="truncate pr-2">
                    Llanta {l.llanta?.marca || ""} {l.llanta?.medida || ""} x{l.cantidad}
                  </span>
                  <span className="font-bold shrink-0">
                    ${Number(l.subtotal || l.precio_unitario * l.cantidad || 0).toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal (sin IVA):</span>
              <span>${subtotalSinIva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>IVA ({tasaIva}%):</span>
              <span>${iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-1 mt-1">
              <span>TOTAL ORDEN:</span>
              <span>${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded p-2.5 text-[11px] flex flex-col gap-1 text-emerald-950">
            <div className="flex justify-between font-bold">
              <span>Cobrado en este movimiento:</span>
              <span>
                ${Number(payment?.monto_total || total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-emerald-800">
              <span>Método:</span>
              <span className="font-bold">
                {payment?.metodo_detalle || payment?.proveedor_pago || "Efectivo en Ventanilla"}
              </span>
            </div>
            {payment?.referencia && (
              <div className="flex justify-between text-[10px] text-emerald-700">
                <span>Referencia / Folio:</span>
                <span className="font-mono">{payment.referencia}</span>
              </div>
            )}
            {cashGiven != null && cashGiven > 0 && (
              <>
                <div className="flex justify-between text-[10px] text-slate-700 pt-1 border-t border-emerald-200">
                  <span>Efectivo entregado por cliente:</span>
                  <span className="font-bold">
                    ${cashGiven.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-black text-emerald-800">
                  <span>Cambio devuelto:</span>
                  <span>
                    ${(changeDue ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between text-[10px] font-bold text-slate-700 pt-1 border-t border-emerald-200">
              <span>Saldo restante por liquidar:</span>
              <span className={saldo > 0 ? "text-rose-600" : "text-emerald-700"}>
                ${saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Footer & Warranty */}
          <div className="text-center text-[9px] text-slate-400 border-t border-slate-200 pt-2 flex flex-col gap-0.5">
            <p className="font-bold text-slate-600">Póliza de Garantía de Servicio</p>
            <p>30 días o 1,000 km en mano de obra. Refacciones y neumáticos según fabricante.</p>
            <p className="mt-1">Si requiere comprobante fiscal digital (CFDI 4.0), solicítelo el mismo mes.</p>
            <p className="font-bold text-slate-500 mt-1">¡Gracias por su preferencia!</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-colors"
          >
            <Printer size={15} /> Imprimir Ticket (80mm)
          </button>

          {cli.telefono && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors"
            >
              <MessageCircle size={15} /> Enviar Ticket por WhatsApp
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
