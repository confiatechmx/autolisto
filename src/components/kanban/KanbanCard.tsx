"use client";

import React from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Wrench,
  User,
  Clock,
  MapPin,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

export type OrderPriority = "low" | "normal" | "high" | "urgent";

export interface Order {
  id: string;
  folio: number;
  columnId: string;
  subEstado?: string | null;
  sucursalId?: string | null;
  sucursalCodigo?: string | null;
  vehicleId: string;
  customerId: string;
  carModel: string;
  carYear?: number | null;
  plates: string;
  customerName: string;
  customerPhone?: string | null;
  priority: OrderPriority;
  services: string[];
  createdAt: string;
  fechaIngresoRaw?: string;
  mechanicId?: string | null;
  mechanicName?: string | null;
  mechanicColor?: string | null;
  bahiaRampa?: string | null;
  estatusPago: string;
  totalAmount: number;
  paidAmount: number;
  aprobadoClienteNombre?: string | null;
  dviCounts: {
    rojo: number;
    amarillo: number;
    verde: number;
  };
}

interface KanbanCardProps {
  order: Order;
  onClick?: (orderId: string) => void;
}

const priorityStyles: Record<OrderPriority, { dot: string; label: string }> = {
  low: { dot: "bg-slate-400", label: "Baja" },
  normal: { dot: "bg-blue-600", label: "Normal" },
  high: { dot: "bg-amber-500", label: "Alta" },
  urgent: { dot: "bg-red-600", label: "Urgente" },
};

export function KanbanCard({ order, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: order.id,
    data: {
      type: "Order",
      order,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="panel-card opacity-50 h-[142px] border-2 border-dashed border-blue-500 bg-blue-50/30 rounded-lg"
      />
    );
  }

  const folioStr = `#${1000 + Number(order.folio || 1)}`;
  const prio = priorityStyles[order.priority] || priorityStyles.normal;
  const totalDvi =
    order.dviCounts.rojo + order.dviCounts.amarillo + order.dviCounts.verde;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="panel-card bg-white border border-slate-200 rounded-lg flex flex-col relative group hover:border-slate-300 transition-all"
    >
      <div
        className="p-3 flex flex-col gap-2 cursor-pointer"
        onClick={() => onClick && onClick(order.id)}
      >
        {/* Row 1: Folio + SubStatus/Bay (Left) | Plates + Drag Handle (Right) */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${prio.dot}`}
              title={`Prioridad: ${prio.label}`}
            />
            <span className="font-mono text-[11px] font-black text-slate-900 tabular-nums">
              {folioStr}
            </span>
            {order.bahiaRampa && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold truncate max-w-[110px]">
                <MapPin size={9} className="text-slate-400 shrink-0" />
                {order.bahiaRampa.replace(/\s*\(.*?\)/, "")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300/80 px-1.5 py-0.5 rounded">
              {order.plates || "S/P"}
            </span>
            <div
              {...attributes}
              {...listeners}
              className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing transition-colors p-1 -mr-1"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={14} strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Row 2: Vehicle Title */}
        <div>
          <h4 className="font-bold text-slate-900 leading-snug text-xs truncate">
            {order.carModel} {order.carYear ? `(${order.carYear})` : ""}
          </h4>

          {/* Clickable Customer Link (stops propagation so it opens Customer 360) */}
          <div className="flex items-center justify-between gap-2 mt-0.5">
            {order.customerId ? (
              <Link
                href={`/clientes/${order.customerId}?vehiculoId=${order.vehicleId}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:underline truncate"
                title="Abrir Expediente 360 del Cliente"
              >
                <User size={11} className="text-slate-400 shrink-0" />
                <span className="truncate">{order.customerName}</span>
                <ExternalLink size={9} className="opacity-0 group-hover:opacity-70 shrink-0" />
              </Link>
            ) : (
              <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 truncate">
                <User size={11} className="text-slate-400 shrink-0" />
                <span className="truncate">{order.customerName}</span>
              </div>
            )}

            {order.aprobadoClienteNombre && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded shrink-0"
                title={`Autorizado digitalmente por ${order.aprobadoClienteNombre}`}
              >
                <ShieldCheck size={10} /> OK
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Services / Work summary pills */}
        {order.services.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {order.services.slice(0, 2).map((service, index) => (
              <span
                key={index}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200 truncate max-w-full"
              >
                {service}
              </span>
            ))}
            {order.services.length > 2 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 tabular-nums">
                +{order.services.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Row 4: Bottom Operational Bar — Mechanic + DVI Traffic Light + Total MXN */}
        <div className="pt-2 mt-0.5 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Mechanic & DVI */}
          <div className="flex items-center gap-1.5 min-w-0">
            {order.mechanicName ? (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 truncate max-w-[105px]"
                title={`Técnico: ${order.mechanicName}`}
              >
                <Wrench size={10} className="text-blue-600 shrink-0" />
                <span className="truncate">{order.mechanicName.split(" ")[0]}</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Sin técnico</span>
            )}

            {/* DVI Traffic Light Pill */}
            {totalDvi > 0 && (
              <div
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-[9px] font-bold tabular-nums shrink-0"
                title={`DVI: ${order.dviCounts.rojo} Urgente, ${order.dviCounts.amarillo} Precaución, ${order.dviCounts.verde} Bien`}
              >
                {order.dviCounts.rojo > 0 && (
                  <span className="text-red-600">●{order.dviCounts.rojo}</span>
                )}
                {order.dviCounts.amarillo > 0 && (
                  <span className="text-amber-500">●{order.dviCounts.amarillo}</span>
                )}
                {order.dviCounts.verde > 0 && (
                  <span className="text-emerald-600">●{order.dviCounts.verde}</span>
                )}
              </div>
            )}
          </div>

          {/* Financial Total & Payment Status */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                order.estatusPago === "Pagado"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : order.estatusPago === "Parcial"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {order.estatusPago === "Pagado"
                ? "Pagado"
                : order.estatusPago === "Parcial"
                ? "Parcial"
                : "Pend."}
            </span>
            <span className="text-xs font-black text-slate-900 font-mono tabular-nums">
              ${order.totalAmount.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
