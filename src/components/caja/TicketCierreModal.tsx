"use client";

import React, { useRef } from "react";
import {
  X,
  Printer,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  MessageCircle,
  FileSpreadsheet,
  Download,
} from "lucide-react";

interface TicketCierreModalProps {
  isOpen: boolean;
  onClose: () => void;
  cierreData: any;
  empresaNombre?: string;
  sucursalNombre?: string;
  cajeroNombre?: string;
}

export function TicketCierreModal({
  isOpen,
  onClose,
  cierreData,
  empresaNombre = "Cova Tires",
  sucursalNombre = "Matriz San Pedro",
  cajeroNombre = "Cajero en Turno",
}: TicketCierreModalProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !cierreData) return null;

  const now = new Date();
  const fechaStr = now.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const horaStr = now.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const f1Declarado = Number(cierreData.declaradoF1 || 0);
  const f2Declarado = Number(cierreData.declaradoF2 || 0);
  const difF1 = Number(cierreData.diferenciaF1 || 0);
  const difF2 = Number(cierreData.diferenciaF2 || 0);
  const remesa = Number(cierreData.remesa || 0);
  const fondoSig = Number(cierreData.fondoSiguiente || 0);
  const teorico = cierreData.resumenTeorico;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push(`REPORTE DE AUDITORÍA Y CORTE DE CAJA (CORTE Z)`);
    lines.push(`Empresa;${empresaNombre}`);
    lines.push(`Sucursal;${sucursalNombre}`);
    lines.push(`Fecha de Emisión;${fechaStr} ${horaStr}`);
    lines.push(`Responsable en Turno;${cajeroNombre}`);
    lines.push(`Turno ID;${cierreData.turno_id || "ACTUAL"}`);
    lines.push(``);

    lines.push(`ARQUEO DE FONDOS EN EFECTIVO`);
    lines.push(`Fondo;Saldo Inicial;Saldo Teórico;Físico Declarado;Variación / Descuadre`);
    lines.push(
      `Fondo 1 (Operativo Mostrador);$${Number(teorico?.fondo1?.apertura || 0).toFixed(2)};$${Number(cierreData.teoricoF1 || 0).toFixed(2)};$${f1Declarado.toFixed(2)};${difF1 > 0 ? "+" : ""}$${difF1.toFixed(2)}`
    );
    lines.push(
      `Fondo 2 (Reserva Taller);$${Number(teorico?.fondo2?.apertura || 0).toFixed(2)};$${Number(cierreData.teoricoF2 || 0).toFixed(2)};$${f2Declarado.toFixed(2)};${difF2 > 0 ? "+" : ""}$${difF2.toFixed(2)}`
    );
    lines.push(``);

    lines.push(`DESTINO DEL EFECTIVO`);
    lines.push(`Concepto;Monto`);
    lines.push(`Remesa Retirada a Caja Fuerte / Depósito;$${remesa.toFixed(2)}`);
    lines.push(`Fondo Base para Siguiente Turno;$${fondoSig.toFixed(2)}`);
    lines.push(``);

    if (teorico?.bancosSPEI && teorico.bancosSPEI.length > 0) {
      lines.push(`CONCILIACIÓN DE TRANSFERENCIAS SPEI POR CUENTA`);
      lines.push(`Cuenta Bancaria;Banco;Transacciones;Monto Total`);
      teorico.bancosSPEI.forEach((b: any) => {
        lines.push(`${b.alias};${b.banco};${b.conteo};$${b.total.toFixed(2)}`);
      });
      lines.push(``);
    }

    lines.push(`TERMINALES Y OTROS MÉTODOS DE PAGO`);
    lines.push(`Método;Transacciones;Monto Total`);
    lines.push(
      `Terminales TPV (Tarjetas);${teorico?.tarjetasTPV?.conteo || 0};$${Number(teorico?.tarjetasTPV?.total || 0).toFixed(2)}`
    );
    if (teorico?.bnpl && teorico.bnpl.total > 0) {
      lines.push(
        `Crédito BNPL (Kueski / Atrato);${teorico.bnpl.conteo};$${Number(teorico.bnpl.total).toFixed(2)}`
      );
    }
    lines.push(``);
    lines.push(
      `TOTAL GENERAL VENTAS DEL TURNO;$${Number(teorico?.totalVentasTurno || 0).toFixed(2)}`
    );

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Corte_Z_${empresaNombre.replace(/\s+/g, "_")}_${now.toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWhatsAppShare = () => {
    let msg = `*CORTE DE CAJA Z - ${empresaNombre.toUpperCase()}*\n`;
    msg += `📍 Sucursal: ${sucursalNombre}\n`;
    msg += `📅 Fecha: ${fechaStr} ${horaStr}\n`;
    msg += `👤 Cajero: ${cajeroNombre}\n\n`;

    msg += `*RESUMEN DE EFECTIVO*\n`;
    msg += `• Fondo 1 (Mostrador): $${f1Declarado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n`;
    if (Math.abs(difF1) > 0) {
      msg += `  ↳ Variación: ${difF1 > 0 ? "+" : ""}$${difF1.toFixed(2)} (${difF1 >= 0 ? "Sobrante" : "Faltante"})\n`;
    }
    msg += `• Fondo 2 (Reserva): $${f2Declarado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n`;
    msg += `• Remesa a Caja Fuerte: $${remesa.toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n`;
    msg += `• Fondo dejado para Mañana: $${fondoSig.toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n\n`;

    if (teorico?.bancosSPEI && teorico.bancosSPEI.length > 0) {
      msg += `*TRANSFERENCIAS SPEI*\n`;
      teorico.bancosSPEI.forEach((b: any) => {
        msg += `• ${b.alias}: $${b.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })} (${b.conteo})\n`;
      });
      msg += `\n`;
    }

    if (teorico?.tarjetasTPV) {
      msg += `*TARJETAS TPV:*\n`;
      msg += `• Total Terminales: $${teorico.tarjetasTPV.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })} (${teorico.tarjetasTPV.conteo})\n\n`;
    }

    if (teorico?.bnpl && teorico.bnpl.total > 0) {
      msg += `*CRÉDITO BNPL:*\n`;
      msg += `• Kueski/Atrato: $${teorico.bnpl.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n\n`;
    }

    msg += `*VENTAS TOTALES DEL TURNO:* $${(teorico?.totalVentasTurno || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/75 backdrop-blur-xs">
      {/* Print Specific CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden; }
              #printable-corte-ticket, #printable-corte-ticket * { visibility: visible; }
              #printable-corte-ticket {
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                max-width: 80mm !important;
                padding: 10px !important;
                margin: 0 auto !important;
                box-shadow: none !important;
                border: none !important;
              }
            }
          `,
        }}
      />

      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold">Comprobante Oficial de Corte Z</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Ticket Area */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <div
            id="printable-corte-ticket"
            ref={ticketRef}
            className="w-full max-w-[340px] bg-white p-5 shadow-sm rounded-xl font-mono text-[11px] text-slate-800 leading-tight border border-slate-200"
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900">
                {empresaNombre}
              </h2>
              <p className="text-[10px] text-slate-500">{sucursalNombre}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {fechaStr} • {horaStr}
              </p>
              <div className="inline-block mt-2 px-2.5 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded">
                REPORTE DE CORTE Z
              </div>
            </div>

            {/* Shift Staff */}
            <div className="py-2.5 border-b border-dashed border-slate-300 text-[10px]">
              <div className="flex justify-between">
                <span>RESPONSABLE:</span>
                <span className="font-bold">{cajeroNombre}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>TURNO ID:</span>
                <span className="font-bold">
                  {cierreData.turno_id ? String(cierreData.turno_id).substring(0, 8) : "ACTUAL"}
                </span>
              </div>
            </div>

            {/* Efectivo Fondos */}
            <div className="py-2.5 border-b border-dashed border-slate-300">
              <span className="font-bold text-[10px] text-slate-900 block mb-1">
                ARQUEO DE FONDOS EN EFECTIVO
              </span>

              <div className="flex justify-between text-[11px]">
                <span>Fondo 1 (Operativo):</span>
                <span className="font-bold tabular-nums">
                  ${f1Declarado.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>↳ Teórico: ${Number(cierreData.teoricoF1 || 0).toFixed(2)}</span>
                <span className={difF1 < 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                  Dif: {difF1 > 0 ? "+" : ""}${difF1.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between text-[11px] mt-2">
                <span>Fondo 2 (Reserva):</span>
                <span className="font-bold tabular-nums">
                  ${f2Declarado.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>↳ Teórico: ${Number(cierreData.teoricoF2 || 0).toFixed(2)}</span>
                <span className={difF2 < 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                  Dif: {difF2 > 0 ? "+" : ""}${difF2.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Remesa & Destino */}
            <div className="py-2.5 border-b border-dashed border-slate-300 text-[10px]">
              <span className="font-bold text-slate-900 block mb-1">
                DESTINO DEL EFECTIVO
              </span>
              <div className="flex justify-between">
                <span>Remesa a Caja Fuerte:</span>
                <span className="font-bold tabular-nums">${remesa.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Fondo Sig. Turno:</span>
                <span className="font-bold tabular-nums">${fondoSig.toFixed(2)}</span>
              </div>
            </div>

            {/* SPEI Multi-Cuenta */}
            {teorico?.bancosSPEI && teorico.bancosSPEI.length > 0 && (
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[10px]">
                <span className="font-bold text-slate-900 block mb-1">
                  TRANSFERENCIAS SPEI POR CUENTA
                </span>
                {teorico.bancosSPEI.map((b: any) => (
                  <div key={b.cuentaId} className="flex justify-between py-0.5">
                    <span className="truncate max-w-[190px]">{b.alias}:</span>
                    <span className="font-bold tabular-nums">${b.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tarjetas & BNPL */}
            <div className="py-2.5 border-b border-dashed border-slate-300 text-[10px]">
              <span className="font-bold text-slate-900 block mb-1">
                TERMINALES Y OTROS MÉTODOS
              </span>
              <div className="flex justify-between">
                <span>Terminales TPV ({teorico?.tarjetasTPV?.conteo || 0}):</span>
                <span className="font-bold tabular-nums">
                  ${Number(teorico?.tarjetasTPV?.total || 0).toFixed(2)}
                </span>
              </div>
              {teorico?.bnpl && teorico.bnpl.total > 0 && (
                <div className="flex justify-between mt-1">
                  <span>BNPL Kueski/Atrato:</span>
                  <span className="font-bold tabular-nums">
                    ${Number(teorico.bnpl.total).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Total Global */}
            <div className="pt-3 pb-4 border-b border-slate-900 text-center">
              <span className="text-[10px] text-slate-500 font-bold">TOTAL VENTAS TURNO</span>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                ${Number(teorico?.totalVentasTurno || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
              </p>
            </div>

            {/* Signatures */}
            <div className="pt-6 grid grid-cols-2 gap-4 text-center text-[9px] text-slate-400">
              <div className="border-t border-slate-400 pt-1">
                Firma Cajero
              </div>
              <div className="border-t border-slate-400 pt-1">
                Firma Supervisor
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions: PDF/Print, CSV Excel, WhatsApp */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            onClick={handleExportCSV}
            className="w-full sm:flex-1 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <FileSpreadsheet size={15} className="text-emerald-700" />
            <span>Descargar Excel (CSV)</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="w-full sm:flex-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <MessageCircle size={15} />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="w-full sm:flex-1 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <Printer size={15} />
            <span>Exportar PDF / Imprimir</span>
          </button>
        </div>
      </div>
    </div>
  );
}
