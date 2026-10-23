"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTenant } from "@/context/TenantContext";
import {
  Printer,
  CheckCircle2,
  ShieldCheck,
  Car,
  User,
  Fuel,
  Gauge,
  Wrench,
  FileCheck2,
  MapPin,
  Phone,
  Globe,
} from "lucide-react";

interface OrderPrintSheetProps {
  order: any;
  mechanicName?: string;
}

const CHECKLIST_LABELS: Record<string, string> = {
  llanta_refaccion: "Llanta de refacción",
  gato_herramienta: "Gato y herramienta",
  tarjeta_circulacion: "Tarjeta de circulación",
  objetos_valor: "Objetos de valor retirados",
  birlo_seguridad: "Llave / Birlo de seguridad",
};

const FUEL_LEVELS = ["Vacío", "1/4", "1/2", "3/4", "Lleno"];

export function OrderPrintSheet({ order, mechanicName }: OrderPrintSheetProps) {
  const { empresa, sucursales } = useTenant();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!order) return null;

  const v = order.vehiculos || {};
  const c = v.clientes || {};
  const sucursal = sucursales.find((s) => s.id === order.sucursal_id) || sucursales[0] || null;
  const folioFormatted = `#${1000 + Number(order.folio || 1)}`;
  const primaryColor = empresa?.color_primario || "#2563EB";

  const checklist: Record<string, boolean> =
    typeof order.checklist_recepcion === "object" && order.checklist_recepcion !== null
      ? order.checklist_recepcion
      : {
          llanta_refaccion: true,
          gato_herramienta: true,
          tarjeta_circulacion: true,
          objetos_valor: false,
          birlo_seguridad: true,
        };

  const services = (order.orden_servicio_servicios || []).filter(
    (s: any) => s.estatus_aprobacion !== "Diferido"
  );
  const parts = (order.orden_servicio_refacciones || []).filter(
    (r: any) => r.estatus_aprobacion !== "Diferido"
  );
  const tires = (order.cotizaciones?.detalles_cotizacion || []).filter(
    (t: any) => t.estatus_aprobacion !== "Diferido"
  );
  const dviItems = order.inspecciones_dvi || [];

  const subtotalServicios = services.reduce(
    (acc: number, s: any) => acc + Number(s.precio_cobrado || 0) * Number(s.cantidad || 1),
    0
  );
  const subtotalRefacciones = parts.reduce((acc: number, r: any) => acc + Number(r.subtotal || 0), 0);
  const subtotalLlantas = tires.reduce((acc: number, t: any) => acc + Number(t.subtotal || 0), 0);
  const granTotal = subtotalServicios + subtotalRefacciones + subtotalLlantas;

  const pagosAprobados = (order.pagos_orden || []).filter(
    (p: any) => p.estatus === "Aprobado" && !p.deleted_at
  );
  const totalPagado = pagosAprobados.reduce((acc: number, p: any) => acc + Number(p.monto_total || 0), 0);
  const saldoPendiente = Math.max(0, granTotal - totalPagado);

  const tasaIva = Number(empresa?.tasa_iva ?? 16);
  const subtotalSinIva = granTotal / (1 + tasaIva / 100);
  const ivaCalculado = granTotal - subtotalSinIva;

  const handlePrint = () => {
    window.print();
  };

  const sheetDocument = (
    <div className="bg-white text-slate-900 border border-slate-200 rounded-lg shadow-sm print:shadow-none print:border-0 p-6 sm:p-8 max-w-4xl mx-auto text-xs leading-relaxed">
      {/* Top Banner / Brand Header */}
      <div
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b-2"
        style={{ borderColor: primaryColor }}
      >
        <div className="flex items-start gap-3.5">
          {empresa?.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={empresa.nombre_comercial}
              className="w-14 h-14 object-contain rounded-md border border-slate-200 p-1 bg-white"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-black text-lg shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              {(empresa?.nombre_comercial || "TR").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
              {empresa?.nombre_comercial || "Torque & Ruta - Centro Automotriz"}
            </h1>
            {empresa?.eslogan && (
              <p className="text-[11px] font-medium text-slate-600">{empresa.eslogan}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 mt-1">
              {empresa?.rfc && (
                <span className="font-mono font-semibold text-slate-700">RFC: {empresa.rfc}</span>
              )}
              {(sucursal?.nombre || sucursal?.codigo) && (
                <span className="font-semibold text-slate-700">
                  Sucursal: {sucursal.nombre} ({sucursal.codigo})
                </span>
              )}
              {(sucursal?.direccion || empresa?.direccion) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={10} /> {sucursal?.direccion || empresa?.direccion}
                </span>
              )}
              {(sucursal?.telefono || empresa?.telefono) && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Phone size={10} /> {sucursal?.telefono || empresa?.telefono}
                </span>
              )}
              {empresa?.sitio_web && (
                <span className="inline-flex items-center gap-1">
                  <Globe size={10} /> {empresa.sitio_web}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:items-end shrink-0 bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Orden de Servicio
          </span>
          <span
            className="text-xl font-black font-mono tabular-nums tracking-tight"
            style={{ color: primaryColor }}
          >
            {folioFormatted}
          </span>
          <div className="text-[10px] text-slate-500 tabular-nums mt-0.5">
            Ingreso:{" "}
            <strong className="text-slate-700">
              {order.fecha_ingreso
                ? new Date(order.fecha_ingreso).toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Hoy"}
            </strong>
          </div>
          {order.bahia_rampa && (
            <div className="text-[10px] text-slate-500 mt-0.5">
              Bahía / Rampa: <strong className="text-slate-800">{order.bahia_rampa}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Customer & Vehicle Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
        {/* Cliente */}
        <div className="border border-slate-200 rounded-md p-3 bg-slate-50/40">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5 mb-2">
            <User size={12} className="text-slate-600" /> Datos del Cliente
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
            <div className="col-span-2">
              <span className="text-slate-500">Nombre / Razón Social: </span>
              <strong className="text-slate-900">{c.nombre || "Cliente Mostrador"}</strong>
            </div>
            <div>
              <span className="text-slate-500">Teléfono: </span>
              <strong className="text-slate-800 tabular-nums">{c.telefono || "N/A"}</strong>
            </div>
            <div>
              <span className="text-slate-500">RFC: </span>
              <strong className="text-slate-800 font-mono">{c.rfc || "XAXX010101000"}</strong>
            </div>
            {c.correo && (
              <div className="col-span-2">
                <span className="text-slate-500">Correo: </span>
                <span className="text-slate-800">{c.correo}</span>
              </div>
            )}
            {c.empresa && (
              <div className="col-span-2">
                <span className="text-slate-500">Empresa / Flotilla: </span>
                <strong className="text-slate-800">{c.empresa}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Vehículo */}
        <div className="border border-slate-200 rounded-md p-3 bg-slate-50/40">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5 mb-2">
            <Car size={12} className="text-slate-600" /> Identificación del Vehículo
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
            <div className="col-span-2">
              <span className="text-slate-500">Unidad: </span>
              <strong className="text-slate-900">
                {v.marca} {v.modelo} {v.anio ? `(${v.anio})` : ""}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Placas: </span>
              <strong className="text-slate-900 font-mono uppercase bg-slate-200/70 px-1.5 py-0.5 rounded">
                {v.placas || "S/P"}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Color: </span>
              <strong className="text-slate-800">{v.color || "N/E"}</strong>
            </div>
            <div>
              <span className="text-slate-500">VIN / Serie: </span>
              <strong className="text-slate-800 font-mono text-[10px]">{v.vin || "No registrado"}</strong>
            </div>
            <div>
              <span className="text-slate-500">Medida OEM: </span>
              <strong className="text-slate-800 font-mono">{v.medida_oem || "Estándar"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Check-in Operational Strip: Mileage, Fuel, Mechanic, Checklist */}
      <div className="border border-slate-200 rounded-md p-3 mb-4 bg-white">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Gauge size={15} className="text-slate-500 shrink-0" />
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">
                Kilometraje Ingreso
              </span>
              <span className="text-xs font-bold text-slate-900 tabular-nums">
                {Number(order.kilometraje_ingreso || 0).toLocaleString("es-MX")} km
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Fuel size={15} className="text-slate-500 shrink-0" />
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">
                Nivel de Combustible
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                {FUEL_LEVELS.map((lvl) => (
                  <span
                    key={lvl}
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      order.nivel_gasolina === lvl
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {lvl}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Wrench size={15} className="text-slate-500 shrink-0" />
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">
                Técnico Asignado
              </span>
              <span className="text-xs font-bold text-slate-900">
                {mechanicName || order.mecanico?.nombre || "Asignación en piso"}
              </span>
            </div>
          </div>

          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">
              Estatus de Orden
            </span>
            <span className="text-xs font-bold text-slate-900">
              {order.estado} {order.sub_estado ? `• ${order.sub_estado}` : ""}
            </span>
          </div>
        </div>

        {/* Inventario de Recepción */}
        <div className="pt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Inventario de Recepción:
          </span>
          {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
            const checked = !!checklist[key];
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                  checked ? "text-slate-900" : "text-slate-400 line-through"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-sm inline-flex items-center justify-center text-[9px] font-bold border ${
                    checked
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-300 border-slate-300"
                  }`}
                >
                  {checked ? "✓" : ""}
                </span>
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Problema Reportado & Diagnóstico Técnico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="border border-slate-200 rounded-md p-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Solicitud / Falla Reportada por el Cliente
          </span>
          <p className="text-[11px] text-slate-800 whitespace-pre-line">
            {order.problema_reportado || order.notas_recepcion || "Revisión general y mantenimiento."}
          </p>
        </div>
        <div className="border border-slate-200 rounded-md p-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Diagnóstico Técnico de Taller
          </span>
          <p className="text-[11px] text-slate-800 whitespace-pre-line">
            {order.diagnostico_tecnico || "En evaluación por especialista."}
          </p>
        </div>
      </div>

      {/* Resumen de Inspección Multipunto (DVI) */}
      {dviItems.length > 0 && (
        <div className="mb-4 border border-slate-200 rounded-md overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Inspección Digital Multipunto (DVI)
            </span>
            <div className="flex items-center gap-2 text-[10px] font-semibold">
              <span className="text-emerald-700">
                ● {dviItems.filter((i: any) => i.severidad === "verde").length} Bien
              </span>
              <span className="text-amber-700">
                ● {dviItems.filter((i: any) => i.severidad === "amarillo").length} Precaución
              </span>
              <span className="text-red-700">
                ● {dviItems.filter((i: any) => i.severidad === "rojo").length} Urgente
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-200">
            {dviItems.map((item: any) => (
              <div key={item.id} className="px-3 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      item.severidad === "rojo"
                        ? "bg-red-100 text-red-800"
                        : item.severidad === "amarillo"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {item.severidad === "rojo"
                      ? "Urgente"
                      : item.severidad === "amarillo"
                      ? "Atención"
                      : "OK"}
                  </span>
                  <strong className="text-slate-800">{item.punto_inspeccion}</strong>
                  <span className="text-slate-400">({item.categoria})</span>
                </div>
                <span className="text-slate-600 truncate max-w-md">
                  {item.observaciones || item.recomendacion || "Sin observaciones"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desglose de Partidas (Mano de Obra, Refacciones y Neumáticos) */}
      <div className="border border-slate-200 rounded-md overflow-hidden mb-4">
        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
            Desglose de Servicios, Refacciones y Neumáticos Autorizados
          </span>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 bg-slate-50">
              <th className="py-2 px-3">Tipo</th>
              <th className="py-2 px-3">Concepto / Número de Parte</th>
              <th className="py-2 px-3 text-center">Cant.</th>
              <th className="py-2 px-3 text-right">P. Unitario</th>
              <th className="py-2 px-3 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            {services.map((s: any) => {
              const qty = Number(s.cantidad || 1);
              const unit = Number(s.precio_cobrado || 0);
              return (
                <tr key={`srv-${s.id}`}>
                  <td className="py-2 px-3 font-semibold text-slate-600">Mano de Obra</td>
                  <td className="py-2 px-3 font-medium text-slate-900">
                    {s.servicios_taller?.nombre || "Servicio de Taller"}
                    {s.notas && <span className="block text-[10px] text-slate-500">{s.notas}</span>}
                  </td>
                  <td className="py-2 px-3 text-center tabular-nums">{qty}</td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    ${unit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold tabular-nums">
                    ${(unit * qty).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}

            {parts.map((r: any) => (
              <tr key={`part-${r.id}`}>
                <td className="py-2 px-3 font-semibold text-slate-600">Refacción</td>
                <td className="py-2 px-3 font-medium text-slate-900">
                  {r.nombre}
                  {(r.numero_parte || r.proveedor) && (
                    <span className="block text-[10px] text-slate-500 font-mono">
                      {r.numero_parte ? `P/N: ${r.numero_parte}` : ""}{" "}
                      {r.proveedor ? `• Prov: ${r.proveedor}` : ""}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-center tabular-nums">{r.cantidad}</td>
                <td className="py-2 px-3 text-right tabular-nums">
                  ${Number(r.precio_unitario || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-right font-semibold tabular-nums">
                  ${Number(r.subtotal || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}

            {tires.map((t: any) => {
              const tire = t.inventario_llantas;
              const medida = tire ? `${tire.ancho}/${tire.perfil} R${tire.rin}` : "";
              return (
                <tr key={`tire-${t.id}`}>
                  <td className="py-2 px-3 font-semibold text-slate-600">Neumático</td>
                  <td className="py-2 px-3 font-medium text-slate-900">
                    {tire?.marca} {tire?.modelo_llanta}{" "}
                    <span className="font-mono text-slate-600">{medida}</span>
                  </td>
                  <td className="py-2 px-3 text-center tabular-nums">{t.cantidad}</td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    ${Number(t.precio_unitario || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold tabular-nums">
                    ${Number(t.subtotal || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}

            {services.length === 0 && parts.length === 0 && tires.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                  Sin partidas cargadas aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals Footer inside Table Card */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div className="text-[10px] text-slate-500 max-w-md">
            <strong className="text-slate-700 uppercase block mb-0.5">
              Términos y Condiciones de Garantía:
            </strong>
            {empresa?.terminos_condiciones ||
              "Garantía de 30 días o 1,000 km en mano de obra. Refacciones y neumáticos sujetos a garantía del fabricante."}
          </div>

          <div className="w-full sm:w-64 space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal antes de IVA:</span>
              <span className="tabular-nums font-medium">
                ${subtotalSinIva.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>IVA ({tasaIva}% incluido):</span>
              <span className="tabular-nums font-medium">
                ${ivaCalculado.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-300 pt-1">
              <span>GRAN TOTAL:</span>
              <span className="tabular-nums">
                ${granTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
              </span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Total Abonado / Pagado:</span>
              <span className="tabular-nums">
                ${totalPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold">
              <span>Saldo Pendiente:</span>
              <span className="tabular-nums">
                ${saldoPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Digital Approval Badge or Signature Lines */}
      {order.aprobado_cliente_nombre && (
        <div className="mb-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <div>
              <span className="text-[11px] font-bold text-emerald-950 block">
                Presupuesto Autorizado Digitalmente por el Cliente
              </span>
              <span className="text-[10px] text-emerald-700">
                Firmado por: <strong>{order.aprobado_cliente_nombre}</strong>{" "}
                {order.aprobado_cliente_at
                  ? `el ${new Date(order.aprobado_cliente_at).toLocaleString("es-MX")}`
                  : ""}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
            FIRMA DIGITAL VERIFICADA
          </span>
        </div>
      )}

      {/* Physical Signature Block */}
      <div className="grid grid-cols-2 gap-8 pt-8 mt-4">
        <div className="border-t border-slate-400 pt-2 text-center">
          <p className="text-[11px] font-bold text-slate-800">
            {order.aprobado_cliente_nombre || c.nombre || "Nombre y Firma del Cliente"}
          </p>
          <p className="text-[10px] text-slate-500">
            Acepto inventario de recepción, presupuesto y condiciones de servicio
          </p>
        </div>
        <div className="border-t border-slate-400 pt-2 text-center">
          <p className="text-[11px] font-bold text-slate-800">
            Asesor de Servicio • {empresa?.nombre_comercial}
          </p>
          <p className="text-[10px] text-slate-500">
            Recepción y Control de Calidad ({sucursal?.nombre || "Matriz"})
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Action Bar (Screen Only) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white px-4 py-3 rounded-lg no-print">
        <div className="flex items-center gap-2.5">
          <FileCheck2 size={18} className="text-blue-400 shrink-0" />
          <div>
            <h4 className="text-xs font-bold">Hoja Oficial de Recepción y Orden de Trabajo ({folioFormatted})</h4>
            <p className="text-[11px] text-slate-300">
              Formato optimizado para impresión tamaño Carta / A4 o exportación directa a PDF con el branding del taller.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-95 cursor-pointer shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          <Printer size={15} />
          Imprimir / Descargar PDF
        </button>
      </div>

      {/* Screen Preview */}
      {sheetDocument}

      {/* Print Portal outside .no-print Modal container */}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-0 m-0">
            {sheetDocument}
          </div>,
          document.body
        )}
    </div>
  );
}
