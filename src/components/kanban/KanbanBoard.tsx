"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard, Order, OrderPriority } from "./KanbanCard";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Wrench,
  Banknote,
  Building2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/context/TenantContext";
import { Modal } from "../ui/Modal";
import { OrderForm } from "./OrderForm";
import { OrderDetailsModal } from "./OrderDetailsModal";

const defaultColumns = [
  { id: "Citas del Día", title: "Citas del Día", color: "#64748B" },
  { id: "En Inspección", title: "En Inspección (DVI)", color: "#D97706" },
  { id: "En Rampa", title: "En Rampa (Trabajando)", color: "#2563EB" },
  { id: "Listo para Entrega", title: "Listo para Entrega", color: "#059669" },
];

function SkeletonCard() {
  return (
    <div className="panel-card p-3 flex flex-col gap-2 relative animate-pulse bg-white">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-1.5 flex-1">
          <div className="w-2 h-2 rounded-full bg-slate-200" />
          <div className="h-3.5 bg-slate-200 rounded w-16" />
        </div>
        <div className="h-4 bg-slate-200 rounded w-14" />
      </div>
      <div className="h-4 bg-slate-200 rounded w-36 mt-1" />
      <div className="flex justify-between items-end mt-2 pt-2 border-t border-slate-100">
        <div className="h-3.5 bg-slate-200 rounded w-20" />
        <div className="h-4 bg-slate-200 rounded w-16" />
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sucursalActiva, sucursales } = useTenant();

  const [columns] = useState(defaultColumns);
  const [orders, setOrders] = useState<Order[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [initialColumn, setInitialColumn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & View Mode
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMechanicFilter, setSelectedMechanicFilter] = useState<string>("ALL");
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>("ALL");

  // Modals & Deep-link state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [initialClientId, setInitialClientId] = useState<string | null>(null);
  const [initialVehicleId, setInitialVehicleId] = useState<string | null>(null);
  const [initialDiferidoId, setInitialDiferidoId] = useState<string | null>(null);

  // Handle URL deep-linking (?ordenId=... or ?nuevaOrden=1&clienteId=...&vehiculoId=...&diferidoId=...)
  useEffect(() => {
    const ordenIdParam = searchParams.get("ordenId");
    const nuevaOrdenParam = searchParams.get("nuevaOrden");
    const clienteIdParam = searchParams.get("clienteId");
    const vehiculoIdParam = searchParams.get("vehiculoId");
    const diferidoIdParam = searchParams.get("diferidoId");

    if (ordenIdParam) {
      setSelectedOrderId(ordenIdParam);
    }
    if (nuevaOrdenParam === "1" || nuevaOrdenParam === "true") {
      setInitialClientId(clienteIdParam);
      setInitialVehicleId(vehiculoIdParam);
      setInitialDiferidoId(diferidoIdParam);
      setIsOrderModalOpen(true);
    }
  }, [searchParams]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: empData }] = await Promise.all([
      supabase
        .from("ordenes_servicio")
        .select(
          `
          id,
          folio,
          estado,
          sub_estado,
          sucursal_id,
          prioridad,
          estatus_pago,
          fecha_ingreso,
          notas_recepcion,
          problema_reportado,
          bahia_rampa,
          mecanico_id,
          aprobado_cliente_nombre,
          vehiculos (
            id,
            marca,
            modelo,
            anio,
            placas,
            clientes (
              id,
              nombre,
              telefono
            )
          ),
          orden_servicio_servicios (
            precio_cobrado,
            cantidad,
            estatus_aprobacion,
            servicios_taller (
              nombre
            )
          ),
          orden_servicio_refacciones (
            nombre,
            subtotal,
            estatus_aprobacion
          ),
          cotizaciones (
            detalles_cotizacion (
              subtotal,
              estatus_aprobacion
            )
          ),
          inspecciones_dvi (
            severidad
          ),
          pagos_orden (
            monto_total,
            estatus,
            deleted_at
          )
        `
        )
        .order("folio", { ascending: false }),
      supabase.from("empleados").select("id, nombre, color_avatar, rol").eq("activo", true),
    ]);

    if (empData) {
      setMechanics(empData.filter((e: any) => e.rol === "Mecánico"));
    }

    if (error) {
      console.error("Error fetching orders:", error);
    } else if (data) {
      const empMap = new Map((empData || []).map((e: any) => [e.id, e]));
      const sucMap = new Map((sucursales || []).map((s) => [s.id, s]));

      const formattedOrders: Order[] = data.map((d: any) => {
        const mech = d.mecanico_id ? empMap.get(d.mecanico_id) : null;
        const suc = d.sucursal_id ? sucMap.get(d.sucursal_id) : null;

        const srvs = (d.orden_servicio_servicios || []).filter(
          (s: any) => s.estatus_aprobacion !== "Diferido"
        );
        const parts = (d.orden_servicio_refacciones || []).filter(
          (r: any) => r.estatus_aprobacion !== "Diferido"
        );
        const tires = (d.cotizaciones?.detalles_cotizacion || []).filter(
          (t: any) => t.estatus_aprobacion !== "Diferido"
        );

        const totalServicios = srvs.reduce(
          (acc: number, s: any) => acc + Number(s.precio_cobrado || 0) * Number(s.cantidad || 1),
          0
        );
        const totalParts = parts.reduce((acc: number, r: any) => acc + Number(r.subtotal || 0), 0);
        const totalTires = tires.reduce((acc: number, t: any) => acc + Number(t.subtotal || 0), 0);
        const totalAmount = totalServicios + totalParts + totalTires;

        const paidAmount = (d.pagos_orden || [])
          .filter((p: any) => p.estatus === "Aprobado" && !p.deleted_at)
          .reduce((acc: number, p: any) => acc + Number(p.monto_total || 0), 0);

        const serviceLabels: string[] = [
          ...srvs.map((s: any) => s.servicios_taller?.nombre).filter(Boolean),
          ...parts.map((r: any) => r.nombre).filter(Boolean),
        ];
        if (serviceLabels.length === 0 && (d.problema_reportado || d.notas_recepcion)) {
          serviceLabels.push(d.problema_reportado || d.notas_recepcion);
        }

        const dviList = d.inspecciones_dvi || [];
        const dviCounts = {
          rojo: dviList.filter((i: any) => i.severidad === "rojo").length,
          amarillo: dviList.filter((i: any) => i.severidad === "amarillo").length,
          verde: dviList.filter((i: any) => i.severidad === "verde").length,
        };

        return {
          id: d.id,
          folio: d.folio || 1,
          columnId: d.estado,
          subEstado: d.sub_estado,
          sucursalId: d.sucursal_id,
          sucursalCodigo: suc?.codigo || null,
          vehicleId: d.vehiculos?.id || "",
          customerId: d.vehiculos?.clientes?.id || "",
          carModel: `${d.vehiculos?.marca || ""} ${d.vehiculos?.modelo || ""}`.trim(),
          carYear: d.vehiculos?.anio || null,
          plates: d.vehiculos?.placas || "S/P",
          customerName: d.vehiculos?.clientes?.nombre || "Cliente",
          customerPhone: d.vehiculos?.clientes?.telefono || null,
          priority: (d.prioridad as OrderPriority) || "normal",
          services: serviceLabels,
          createdAt: d.fecha_ingreso
            ? new Date(d.fecha_ingreso).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          fechaIngresoRaw: d.fecha_ingreso,
          mechanicId: d.mecanico_id,
          mechanicName: mech?.nombre || null,
          mechanicColor: mech?.color_avatar || null,
          bahiaRampa: d.bahia_rampa || null,
          estatusPago: d.estatus_pago || "Pendiente",
          totalAmount,
          paidAmount,
          aprobadoClienteNombre: d.aprobado_cliente_nombre || null,
          dviCounts,
        };
      });
      setOrders(formattedOrders);
    }
    setLoading(false);
  }, [sucursales]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const order = orders.find((o) => o.id === active.id);
    if (order) {
      setActiveOrder(order);
      setInitialColumn(order.columnId);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Order";
    const isOverTask = over.data.current?.type === "Order";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveTask) return;

    if (isActiveTask && isOverTask) {
      setOrders((orders) => {
        const activeIndex = orders.findIndex((t) => t.id === activeId);
        const overIndex = orders.findIndex((t) => t.id === overId);

        if (orders[activeIndex].columnId !== orders[overIndex].columnId) {
          const newOrders = [...orders];
          newOrders[activeIndex].columnId = orders[overIndex].columnId;
          return arrayMove(newOrders, activeIndex, overIndex);
        }
        return arrayMove(orders, activeIndex, overIndex);
      });
    }

    if (isActiveTask && isOverColumn) {
      setOrders((orders) => {
        const activeIndex = orders.findIndex((t) => t.id === activeId);
        const newOrders = [...orders];
        newOrders[activeIndex].columnId = overId as string;
        return arrayMove(newOrders, activeIndex, activeIndex);
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrder(null);
    const { active } = event;
    const order = orders.find((o) => o.id === active.id);

    if (order && initialColumn !== null && order.columnId !== initialColumn) {
      supabase
        .from("ordenes_servicio")
        .update({ estado: order.columnId })
        .eq("id", order.id)
        .then(({ error }) => {
          if (error) {
            console.error("Error updating order state in Supabase:", error);
          }
        });
    }
    setInitialColumn(null);
  };

  const handleInlineStageChange = async (orderId: string, newStage: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, columnId: newStage } : o))
    );
    await supabase.from("ordenes_servicio").update({ estado: newStage }).eq("id", orderId);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Branch filter from TenantContext
      if (sucursalActiva && order.sucursalId && order.sucursalId !== sucursalActiva.id) {
        return false;
      }
      // Mechanic filter
      if (selectedMechanicFilter !== "ALL") {
        if (selectedMechanicFilter === "UNASSIGNED" && order.mechanicId) return false;
        if (selectedMechanicFilter !== "UNASSIGNED" && order.mechanicId !== selectedMechanicFilter)
          return false;
      }
      // Payment status filter
      if (selectedPaymentFilter !== "ALL" && order.estatusPago !== selectedPaymentFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const folioStr = `#${1000 + Number(order.folio || 1)}`.toLowerCase();
        const matchFolio = folioStr.includes(query);
        const matchName = order.customerName.toLowerCase().includes(query);
        const matchCar = order.carModel.toLowerCase().includes(query);
        const matchPlates = order.plates.toLowerCase().includes(query);
        const matchBay = (order.bahiaRampa || "").toLowerCase().includes(query);
        return matchFolio || matchName || matchCar || matchPlates || matchBay;
      }
      return true;
    });
  }, [
    orders,
    sucursalActiva,
    selectedMechanicFilter,
    selectedPaymentFilter,
    searchQuery,
  ]);

  const totalValorEnPiso = useMemo(
    () => filteredOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0),
    [filteredOrders]
  );
  const enRampaCount = useMemo(
    () => filteredOrders.filter((o) => o.columnId === "En Rampa").length,
    [filteredOrders]
  );
  const listoEntregaCount = useMemo(
    () => filteredOrders.filter((o) => o.columnId === "Listo para Entrega").length,
    [filteredOrders]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header & Top Operational Strip */}
      <div className="mb-3 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Tablero de Operaciones (Workflow)
              </h1>
              {sucursalActiva ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                  <Building2 size={11} /> {sucursalActiva.nombre} ({sucursalActiva.codigo})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                  Vista Consolidada Multi-Sucursal
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de órdenes en piso, bahías de trabajo, inspecciones DVI y rentabilidad en tiempo real.
            </p>
          </div>

          {/* KPI Pills + New Order Button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden xl:flex items-center gap-3 bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs mr-1">
              <div>
                <span className="text-slate-400 font-medium">Activas: </span>
                <strong className="text-slate-900 tabular-nums">{filteredOrders.length}</strong>
              </div>
              <span className="text-slate-200">|</span>
              <div>
                <span className="text-slate-400 font-medium">En Rampa: </span>
                <strong className="text-blue-600 tabular-nums">{enRampaCount}</strong>
              </div>
              <span className="text-slate-200">|</span>
              <div>
                <span className="text-slate-400 font-medium">Valor en Piso: </span>
                <strong className="text-slate-900 font-mono tabular-nums">
                  ${totalValorEnPiso.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setInitialClientId(null);
                setInitialVehicleId(null);
                setInitialDiferidoId(null);
                setIsOrderModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} />
              Nueva Orden de Servicio
            </button>
          </div>
        </div>

        {/* Dense Filter Bar + View Toggle */}
        <div className="flex flex-col sm:flex-row flex-wrap sm:items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Search size={13} className="text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar folio (#1001), placa, cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-8 pr-3 h-8 border border-slate-300 rounded-md bg-slate-50/60 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 text-xs transition-all"
              />
            </div>

            {/* Mechanic Filter */}
            <div className="flex items-center gap-1.5">
              <Wrench size={13} className="text-slate-400 hidden sm:block" />
              <select
                value={selectedMechanicFilter}
                onChange={(e) => setSelectedMechanicFilter(e.target.value)}
                className="h-8 text-xs font-medium bg-white border border-slate-300 rounded-md px-2.5 text-slate-700 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">Técnicos: Todos</option>
                <option value="UNASSIGNED">Sin Técnico Asignado</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Filter */}
            <div className="flex items-center gap-1.5">
              <Banknote size={13} className="text-slate-400 hidden sm:block" />
              <select
                value={selectedPaymentFilter}
                onChange={(e) => setSelectedPaymentFilter(e.target.value)}
                className="h-8 text-xs font-medium bg-white border border-slate-300 rounded-md px-2.5 text-slate-700 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">Cobranza: Todos</option>
                <option value="Pendiente">Pago Pendiente</option>
                <option value="Parcial">Pago Parcial</option>
                <option value="Pagado">Pagado</option>
              </select>
            </div>

            <button
              type="button"
              onClick={fetchOrders}
              title="Actualizar tablero"
              className="h-8 px-2.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* View Mode Toggle: Kanban vs Lista Compacta */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LayoutGrid size={13} />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <List size={13} />
              Lista Compacta
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Kanban View vs Compact List Table View */}
      {viewMode === "kanban" ? (
        <div className="flex-1 w-full pb-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full h-full overflow-x-auto snap-x snap-mandatory pb-2 dense-scrollbar">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className="h-full flex flex-col relative min-w-[85vw] sm:min-w-[45vw] md:min-w-0 snap-center md:snap-align-none"
                >
                  {loading && (
                    <div className="absolute top-11 left-0 right-0 bottom-0 z-20 flex flex-col gap-2.5 p-2.5 overflow-hidden bg-slate-100/80">
                      <SkeletonCard />
                      <SkeletonCard />
                      <SkeletonCard />
                    </div>
                  )}
                  <KanbanColumn
                    id={col.id}
                    title={col.title}
                    accentColor={col.color}
                    orders={filteredOrders.filter((o) => o.columnId === col.id)}
                    onCardClick={(id) => setSelectedOrderId(id)}
                  />
                </div>
              ))}
            </div>

            <DragOverlay>
              {activeOrder ? <KanbanCard order={activeOrder} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      ) : (
        /* LISTA COMPACTA (SHOPMONKEY TABLE VIEW) */
        <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1 dense-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Vehículo / Placas</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Bahía / Rampa</th>
                  <th className="py-2.5 px-3">Técnico</th>
                  <th className="py-2.5 px-3">Etapa Operativa</th>
                  <th className="py-2.5 px-3 text-center">DVI</th>
                  <th className="py-2.5 px-3 text-center">Cobranza</th>
                  <th className="py-2.5 px-3 text-right">Total MXN</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredOrders.map((o) => {
                  const folioStr = `#${1000 + Number(o.folio || 1)}`;
                  const totalDvi =
                    o.dviCounts.rojo + o.dviCounts.amarillo + o.dviCounts.verde;
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedOrderId(o.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-mono font-black text-slate-900 tabular-nums">
                        {folioStr}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">
                          {o.carModel} {o.carYear ? `(${o.carYear})` : ""}
                        </div>
                        <span className="font-mono text-[10px] uppercase bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.2 rounded">
                          {o.plates}
                        </span>
                      </td>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/clientes/${o.customerId}?vehiculoId=${o.vehicleId}`}
                          className="font-semibold text-slate-800 hover:text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {o.customerName}
                          <ExternalLink size={11} className="text-slate-400" />
                        </Link>
                        {o.customerPhone && (
                          <div className="text-[10px] text-slate-400 tabular-nums">
                            {o.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {o.bahiaRampa || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {o.mechanicName || (
                          <span className="text-slate-400 italic">Sin asignar</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={o.columnId}
                          onChange={(e) => handleInlineStageChange(o.id, e.target.value)}
                          className="h-7 text-[11px] font-bold bg-slate-100 border border-slate-300 rounded px-2 text-slate-800"
                        >
                          {columns.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {totalDvi > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold tabular-nums">
                            <span className="text-red-600">●{o.dviCounts.rojo}</span>
                            <span className="text-amber-500">●{o.dviCounts.amarillo}</span>
                            <span className="text-emerald-600">●{o.dviCounts.verde}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Pend.</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            o.estatusPago === "Pagado"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.estatusPago === "Parcial"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {o.estatusPago}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 tabular-nums">
                        ${o.totalAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(o.id)}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs text-slate-400">
                      No se encontraron órdenes con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for New Order */}
      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title="Recepción y Apertura de Orden de Servicio"
        description="Asigna cliente, unidad, sucursal, rampa y registra el check-in inicial."
        size="lg"
      >
        <OrderForm
          initialClientId={initialClientId}
          initialVehicleId={initialVehicleId}
          initialDiferidoId={initialDiferidoId}
          onSuccess={(createdOrderId) => {
            setIsOrderModalOpen(false);
            fetchOrders();
            if (createdOrderId) {
              setSelectedOrderId(createdOrderId);
            }
          }}
          onCancel={() => setIsOrderModalOpen(false)}
        />
      </Modal>

      {/* Modal for Full Tabbed Order Workspace */}
      <Modal
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        title="Estación de Trabajo de Orden de Servicio (Shopmonkey Workspace)"
        description="Cotización de Mano de Obra y Refacciones, Calculadora de Margen, DVI Persistente, Cobranza e Impresión."
        size="full"
      >
        {selectedOrderId && (
          <OrderDetailsModal
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
            onUpdate={fetchOrders}
          />
        )}
      </Modal>
    </div>
  );
}
