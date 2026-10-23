"use client";

import React, { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard, Order } from "./KanbanCard";

interface KanbanColumnProps {
  id: string;
  title: string;
  accentColor?: string;
  orders: Order[];
  onCardClick?: (orderId: string) => void;
}

export function KanbanColumn({
  id,
  title,
  accentColor = "#2563EB",
  orders,
  onCardClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: "Column",
    },
  });

  const orderIds = useMemo(() => orders.map((o) => o.id), [orders]);
  const columnTotal = useMemo(
    () => orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0),
    [orders]
  );

  return (
    <div className="flex flex-col bg-slate-100/80 border border-slate-200/90 rounded-lg h-full max-h-[calc(100vh-215px)] overflow-hidden">
      {/* Top Color Bar */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: accentColor }} />

      {/* Column Header */}
      <div className="px-3.5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider truncate">
            {title}
          </h3>
          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-1.5 py-0.2 rounded tabular-nums">
            {orders.length}
          </span>
        </div>
        <span className="text-[11px] font-mono font-bold text-slate-600 tabular-nums">
          ${columnTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
        </span>
      </div>

      {/* Scrollable Cards Container */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2.5 flex flex-col gap-2.5 overflow-y-auto dense-scrollbar transition-colors ${
          isOver ? "bg-blue-50/60" : ""
        }`}
      >
        <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
          {orders.map((order) => (
            <KanbanCard key={order.id} order={order} onClick={onCardClick} />
          ))}
        </SortableContext>

        {orders.length === 0 && (
          <div className="py-10 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-md">
            Arrastra una orden aquí
          </div>
        )}

        <div className="min-h-[16px] shrink-0" />
      </div>
    </div>
  );
}
