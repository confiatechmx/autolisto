"use client";

import React, { useRef, useState } from "react";
import {
  X,
  Printer,
  FileText,
  Receipt,
  MessageCircle,
  FileSpreadsheet,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface TicketCierreModalProps {
  isOpen: boolean;
  onClose: () => void;
  cierreData: any;
  empresaNombre?: string;
  sucursalNombre?: string;
  cajeroNombre?: string;
}

type FormatoImpresion = "CARTA" | "TICKET";

export function TicketCierreModal({
  isOpen,
  onClose,
  cierreData,
  empresaNombre = "Cova Tires",
  sucursalNombre = "Matriz San Pedro",
  cajeroNombre = "Alejandro Villarreal",
}: TicketCierreModalProps) {
  const [formato, setFormato] = useState<FormatoImpresion>("CARTA");
  const printableRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !cierreData) return null;

  const now = new Date();
  const fechaStr = now.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
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
    lines.push(`ACTA DE CORTE DE CAJA Y ARQUEO DE TURNO (CORTE Z)`);
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
    msg += `• Fondo para Mañana: $${fondoSig.toLocaleString("es-MX", { minimumFractionDigits: 2 })}\n\n`;

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

    msg += `*TOTAL VENTAS TURNO:* $${(teorico?.totalVentasTurno || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/80 backdrop-blur-xs">
      {/* Dynamic Print CSS for Letter vs 80mm */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden; }
              #printable-corte-document, #printable-corte-document * { visibility: visible; }
              #printable-corte-document {
                position: absolute;
                left: 0;
                top: 0;
                width: ${formato === "CARTA" ? "100%" : "80mm"} !important;
                max-width: ${formato === "CARTA" ? "216mm" : "80mm"} !important;
                margin: ${formato === "CARTA" ? "0 auto" : "0"} !important;
                padding: ${formato === "CARTA" ? "12mm" : "6px"} !important;
                box-shadow: none !important;
                border: none !important;
                background: white !important;
                color: black !important;
              }
            }
          `,
        }}
      />

      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with Format Switcher */}
        <div className="p-4 md:p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
              {formato === "CARTA" ? <FileText size={20} /> : <Receipt size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Corte Z Definitivo
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-300">Auditoría Financiera</span>
              </div>
              <h3 className="text-sm md:text-base font-bold">
                {formato === "CARTA"
                  ? "Acta de Cierre y Arqueo de Caja (Hoja Carta)"
                  : "Comprobante Térmico de Entrega (80mm)"}
              </h3>
            </div>
          </div>

          {/* Toggle Formato: CARTA vs TICKET */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-1 rounded-xl flex items-center text-xs font-bold">
              <button
                type="button"
                onClick={() => setFormato("CARTA")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  formato === "CARTA"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FileText size={14} />
                <span>Hoja Carta (Auditoría)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormato("TICKET")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  formato === "TICKET"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Receipt size={14} />
                <span>Ticket 80mm</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable View Container */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <div
            id="printable-corte-document"
            ref={printableRef}
            className={`w-full bg-white shadow-md border border-slate-200 transition-all ${
              formato === "CARTA"
                ? "max-w-[800px] p-8 rounded-2xl text-slate-900"
                : "max-w-[340px] p-5 rounded-xl font-mono text-[11px] text-slate-800 leading-tight"
            }`}
          >
            {/* ============================================================ */}
            {/* FORMATO 1: HOJA TAMAÑO CARTA (AUDITORÍA CONTABLE / ARCHIVO)  */}
            {/* ============================================================ */}
            {formato === "CARTA" && (
              <div className="flex flex-col gap-6 text-xs">
                {/* 1. Encabezado Corporativo */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                        {empresaNombre.substring(0, 2).toUpperCase()}
                      </div>
                      <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                        {empresaNombre}
                      </h1>
                    </div>
                    <p className="text-slate-600 font-medium text-xs mt-1">
                      {sucursalNombre} • Centro de Servicio Automotriz
                    </p>
                    <p className="text-[11px] text-slate-400">
                      RFC: CTV-180422-9A1 • Folio Turno: #{cierreData.turno_id ? String(cierreData.turno_id).substring(0, 8).toUpperCase() : "Z-ACTIVO"}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg tracking-wider uppercase">
                      Acta Oficial de Corte Z
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-2">
                      Fecha: {fechaStr}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Hora de Cierre: {horaStr}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Responsable: <strong>{cajeroNombre}</strong>
                    </p>
                  </div>
                </div>

                {/* 2. Arqueo Comparativo Dual de Efectivo */}
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2.5 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    1. Arqueo Físico de Fondos en Efectivo
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Fondo 1: Mostrador Operativo */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span className="font-bold text-xs text-slate-900">
                            Fondo 1: Operativo (Mostrador)
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              Math.abs(difF1) <= 10
                                ? "bg-emerald-100 text-emerald-800"
                                : difF1 > 0
                                ? "bg-blue-100 text-blue-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {Math.abs(difF1) <= 10
                              ? "✓ Cuadrado"
                              : difF1 > 0
                              ? `+ Sobrante $${difF1.toFixed(2)}`
                              : `- Faltante $${Math.abs(difF1).toFixed(2)}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                          <div>
                            <span className="text-slate-500 block">Saldo Apertura:</span>
                            <span className="font-bold tabular-nums">
                              ${Number(teorico?.fondo1?.apertura || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">(+) Cobros POS:</span>
                            <span className="font-bold text-emerald-700 tabular-nums">
                              +${Number(teorico?.fondo1?.entradasEfectivoPOS || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">(-) Vales y Gastos:</span>
                            <span className="font-bold text-rose-700 tabular-nums">
                              -${Number(teorico?.fondo1?.salidasGastos || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">(±) Traspasos Fondos:</span>
                            <span className="font-bold text-indigo-700 tabular-nums">
                              +${Number((teorico?.fondo1?.traspasosRecibidos || 0) - (teorico?.fondo1?.traspasosEnviados || 0)).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Teórico en Sistema:</span>
                          <span className="font-bold tabular-nums">
                            ${Number(cierreData.teoricoF1 || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block text-[10px]">Físico Contado:</span>
                          <span className="font-black text-slate-900 text-sm tabular-nums">
                            ${f1Declarado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Fondo 2: Reserva Taller */}
                    <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/30 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center border-b border-purple-200 pb-2">
                          <span className="font-bold text-xs text-purple-950">
                            Fondo 2: Reserva (Caja Fuerte)
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              Math.abs(difF2) <= 10
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {Math.abs(difF2) <= 10 ? "✓ Cuadrado" : `Dif: $${difF2.toFixed(2)}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                          <div>
                            <span className="text-slate-500 block">Saldo Apertura:</span>
                            <span className="font-bold tabular-nums">
                              ${Number(teorico?.fondo2?.apertura || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Traspasos Enviados:</span>
                            <span className="font-bold text-purple-800 tabular-nums">
                              -${Number(teorico?.fondo2?.traspasosEnviados || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-purple-200 flex justify-between items-center text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Teórico Reserva:</span>
                          <span className="font-bold tabular-nums">
                            ${Number(cierreData.teoricoF2 || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block text-[10px]">Físico Contado:</span>
                          <span className="font-black text-purple-950 text-sm tabular-nums">
                            ${f2Declarado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Conciliación Espejo Bancaria (3 Cuentas SPEI) */}
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2 flex items-center gap-1.5">
                    <Building2 size={16} className="text-blue-600" />
                    2. Conciliación de Transferencias SPEI (Espejo Bancario)
                  </h2>
                  <table className="w-full text-left border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Cuenta Bancaria</th>
                        <th className="py-2.5 px-3">Banco</th>
                        <th className="py-2.5 px-3 text-center">Transacciones</th>
                        <th className="py-2.5 px-3 text-right">Monto Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {teorico?.bancosSPEI && teorico.bancosSPEI.length > 0 ? (
                        teorico.bancosSPEI.map((b: any) => (
                          <tr key={b.cuentaId}>
                            <td className="py-2 px-3 font-bold text-slate-900">{b.alias}</td>
                            <td className="py-2 px-3 text-slate-600">{b.banco}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-700">{b.conteo}</td>
                            <td className="py-2 px-3 text-right font-black tabular-nums text-slate-900">
                              ${b.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-3 px-3 text-center text-slate-400">
                            Sin transferencias SPEI en este turno
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 4. Resumen de Terminales TPV y BNPL */}
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2">
                    3. Terminales TPV y Financiamiento
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="border border-slate-200 p-2.5 rounded-xl bg-slate-50/50">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">
                        Terminales TPV
                      </span>
                      <span className="font-bold text-slate-900 text-sm tabular-nums">
                        ${Number(teorico?.tarjetasTPV?.total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {teorico?.tarjetasTPV?.conteo || 0} vouchers
                      </span>
                    </div>

                    <div className="border border-slate-200 p-2.5 rounded-xl bg-slate-50/50">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">
                        Crédito BNPL
                      </span>
                      <span className="font-bold text-purple-950 text-sm tabular-nums">
                        ${Number(teorico?.bnpl?.total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {teorico?.bnpl?.conteo || 0} créditos
                      </span>
                    </div>

                    <div className="border border-slate-200 p-2.5 rounded-xl bg-emerald-50/50 border-emerald-200">
                      <span className="text-[10px] text-emerald-800 block uppercase font-bold">
                        Remesa a Guardar
                      </span>
                      <span className="font-bold text-emerald-700 text-sm tabular-nums">
                        ${remesa.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">
                        Sobre / Caja Fuerte
                      </span>
                    </div>

                    <div className="border border-slate-200 p-2.5 rounded-xl bg-slate-50/50">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">
                        Fondo Sig. Turno
                      </span>
                      <span className="font-bold text-slate-900 text-sm tabular-nums">
                        ${fondoSig.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Gaveta mostrador
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gran Total */}
                <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    Total General de Cobros Facturados en el Turno:
                  </span>
                  <span className="text-base font-black text-emerald-400 tabular-nums">
                    ${Number(teorico?.totalVentasTurno || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                  </span>
                </div>

                {/* Justificación de Descuadre si existe */}
                {cierreData.justificacion_descuadre && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
                    <strong>Justificación de Descuadre Registrada:</strong> {cierreData.justificacion_descuadre}
                  </div>
                )}

                {/* Firmas de Entrega / Recepción Legal */}
                <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs text-slate-600">
                  <div>
                    <div className="border-t-2 border-slate-400 pt-2 font-bold text-slate-900">
                      {cajeroNombre}
                    </div>
                    <span className="text-[10px] text-slate-400 block">Cajero(a) Entrega Turno</span>
                  </div>
                  <div>
                    <div className="border-t-2 border-slate-400 pt-2 font-bold text-slate-900">
                      Administrador / Supervisor
                    </div>
                    <span className="text-[10px] text-slate-400 block">Recepción y Validación de Fondos</span>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* FORMATO 2: TICKET TÉRMICO 80MM (RESUMEN PARA SOBRE / GAVETA) */}
            {/* ============================================================ */}
            {formato === "TICKET" && (
              <div>
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
                    TICKET CORTE Z (80MM)
                  </div>
                </div>

                {/* Shift Staff */}
                <div className="py-2 border-b border-dashed border-slate-300 text-[10px]">
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
                    ARQUEO DE EFECTIVO
                  </span>
                  <div className="flex justify-between text-[11px]">
                    <span>Fondo 1 (Mostrador):</span>
                    <span className="font-bold tabular-nums">${f1Declarado.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>↳ Teórico: ${Number(cierreData.teoricoF1 || 0).toFixed(2)}</span>
                    <span className={difF1 < 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                      Dif: {difF1 > 0 ? "+" : ""}${difF1.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] mt-2">
                    <span>Fondo 2 (Reserva):</span>
                    <span className="font-bold tabular-nums">${f2Declarado.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>↳ Teórico: ${Number(cierreData.teoricoF2 || 0).toFixed(2)}</span>
                    <span className={difF2 < 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                      Dif: {difF2 > 0 ? "+" : ""}${difF2.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Remesa & Destino */}
                <div className="py-2 border-b border-dashed border-slate-300 text-[10px]">
                  <span className="font-bold text-slate-900 block mb-1">DESTINO DEL EFECTIVO</span>
                  <div className="flex justify-between">
                    <span>Remesa a Caja Fuerte:</span>
                    <span className="font-bold tabular-nums">${remesa.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Fondo Sig. Turno:</span>
                    <span className="font-bold tabular-nums">${fondoSig.toFixed(2)}</span>
                  </div>
                </div>

                {/* SPEI */}
                {teorico?.bancosSPEI && teorico.bancosSPEI.length > 0 && (
                  <div className="py-2 border-b border-dashed border-slate-300 text-[10px]">
                    <span className="font-bold text-slate-900 block mb-1">SPEI POR CUENTA</span>
                    {teorico.bancosSPEI.map((b: any) => (
                      <div key={b.cuentaId} className="flex justify-between py-0.5">
                        <span className="truncate max-w-[190px]">{b.alias}:</span>
                        <span className="font-bold tabular-nums">${b.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tarjetas */}
                <div className="py-2 border-b border-dashed border-slate-300 text-[10px]">
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

                {/* Total */}
                <div className="pt-2 pb-3 text-center">
                  <span className="text-[10px] text-slate-500 font-bold">TOTAL VENTAS TURNO</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    ${Number(teorico?.totalVentasTurno || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                  </p>
                </div>

                {/* Firmas */}
                <div className="pt-4 grid grid-cols-2 gap-4 text-center text-[8px] text-slate-400">
                  <div className="border-t border-slate-400 pt-1">Firma Cajero</div>
                  <div className="border-t border-slate-400 pt-1">Firma Supervisor</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
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
            <span>
              {formato === "CARTA" ? "Exportar PDF / Imprimir Carta" : "Imprimir Ticket 80mm"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
