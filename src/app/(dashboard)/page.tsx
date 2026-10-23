"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/context/TenantContext";
import Link from "next/link";
import {
  Activity,
  Banknote,
  CarFront,
  Clock,
  Wrench,
  TrendingUp,
  AlertTriangle,
  Plus,
  ArrowRight,
  ExternalLink,
  Building2,
  CheckCircle2,
  Landmark,
  MessageCircle,
  Gauge,
  UserCheck,
  Search,
} from "lucide-react";

export default function DashboardPage() {
  const supabase = createClient();
  const { empresa, sucursalActiva } = useTenant();

  const [loading, setLoading] = useState(true);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [mecanicos, setMecanicos] = useState<any[]>([]);
  const [diferidos, setDiferidos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("Activas");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      let ordQuery = supabase
        .from("ordenes_servicio")
        .select(`
          id,
          folio,
          sucursal_id,
          vehiculo_id,
          mecanico_id,
          asesor_id,
          estado,
          sub_estado,
          prioridad,
          estatus_pago,
          bahia_rampa,
          fecha_ingreso,
          fecha_promesa,
          problema_reportado,
          vehiculos (
            id,
            marca,
            modelo,
            anio,
            placas,
            color,
            cliente_id,
            clientes ( id, nombre, telefono )
          ),
          mecanico:empleados!ordenes_servicio_mecanico_id_fkey (
            id,
            nombre,
            especialidad,
            comision_porcentaje,
            tarifa_hora,
            color_avatar
          ),
          orden_servicio_servicios (
            id,
            precio_cobrado,
            horas_labor,
            mecanico_id,
            estatus_aprobacion,
            servicios_taller ( nombre, categoria )
          ),
          orden_servicio_refacciones (
            id,
            cantidad,
            precio_unitario,
            subtotal,
            estatus_aprobacion
          ),
          cotizaciones (
            id,
            detalles_cotizacion ( subtotal )
          ),
          pagos_orden (
            id,
            monto_total,
            estatus,
            deleted_at
          )
        `)
        .order("fecha_ingreso", { ascending: false });

      if (sucursalActiva) {
        ordQuery = ordQuery.eq("sucursal_id", sucursalActiva.id);
      }

      const [ordRes, empRes, difRes] = await Promise.all([
        ordQuery,
        supabase
          .from("empleados")
          .select("*")
          .eq("rol", "Mecánico")
          .eq("activo", true)
          .order("nombre"),
        supabase
          .from("trabajos_diferidos")
          .select(`
            *,
            vehiculos ( id, marca, modelo, anio, placas ),
            clientes ( id, nombre, telefono )
          `)
          .eq("resuelto", false)
          .order("costo_estimado", { ascending: false }),
      ]);

      if (ordRes.data) {
        const enriched = ordRes.data.map((o: any) => {
          const servicios = (o.orden_servicio_servicios || []).filter(
            (s: any) => s.estatus_aprobacion !== "Diferido"
          );
          const refacciones = (o.orden_servicio_refacciones || []).filter(
            (r: any) => r.estatus_aprobacion !== "Diferido"
          );
          const cotList = Array.isArray(o.cotizaciones)
            ? o.cotizaciones
            : o.cotizaciones
            ? [o.cotizaciones]
            : [];
          const llantas = cotList
            .flatMap((c: any) => c.detalles_cotizacion || [])
            .filter((l: any) => l.estatus_aprobacion !== "Diferido");

          const totalManoObra = servicios.reduce(
            (acc: number, s: any) => acc + Number(s.precio_cobrado || 0),
            0
          );
          const totalHoras = servicios.reduce(
            (acc: number, s: any) => acc + Number(s.horas_labor || 1),
            0
          );
          const totalRefacciones = refacciones.reduce(
            (acc: number, r: any) =>
              acc +
              Number(
                r.subtotal ??
                  Number(r.cantidad || 1) * Number(r.precio_unitario || 0)
              ),
            0
          );
          const totalLlantas = llantas.reduce(
            (acc: number, l: any) => acc + Number(l.subtotal || 0),
            0
          );

          const granTotal = totalManoObra + totalRefacciones + totalLlantas;

          const totalPagado = (o.pagos_orden || [])
            .filter((p: any) => p.estatus === "Aprobado" && !p.deleted_at)
            .reduce((acc: number, p: any) => acc + Number(p.monto_total || 0), 0);

          const saldo = Math.max(0, granTotal - totalPagado);

          return {
            ...o,
            totalManoObra,
            totalHoras,
            totalRefacciones,
            totalLlantas,
            granTotal,
            totalPagado,
            saldo,
          };
        });
        setOrdenes(enriched);
      }

      if (empRes.data) {
        setMecanicos(empRes.data);
      }

      if (difRes.data) {
        setDiferidos(difRes.data);
      }
    } catch (error) {
      console.error("Error loading Shopmonkey dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [sucursalActiva]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Calculate 6 Operational KPIs
  const ordenesActivas = ordenes.filter((o) => o.estado !== "Entregado");
  const ventasTotalesActivas = ordenesActivas.reduce(
    (acc, o) => acc + o.granTotal,
    0
  );
  const ventasTotalesGlobal = ordenes.reduce((acc, o) => acc + o.granTotal, 0);
  const aroTicketPromedio =
    ordenes.length > 0 ? ventasTotalesGlobal / ordenes.length : 0;

  const totalCobrado = ordenes.reduce((acc, o) => acc + o.totalPagado, 0);
  const totalPorCobrar = ordenes.reduce((acc, o) => acc + o.saldo, 0);

  const countCitas = ordenesActivas.filter(
    (o) => o.estado === "Citas del Día"
  ).length;
  const countInspeccion = ordenesActivas.filter(
    (o) => o.estado === "En Inspección"
  ).length;
  const countEnRampa = ordenesActivas.filter(
    (o) => o.estado === "En Rampa"
  ).length;
  const countListos = ordenesActivas.filter(
    (o) => o.estado === "Listo para Entrega"
  ).length;

  const horasFacturadas = ordenes.reduce((acc, o) => acc + o.totalHoras, 0);
  const carteraDiferidos = diferidos.reduce(
    (acc, d) => acc + Number(d.costo_estimado || 0),
    0
  );

  // Technician Productivity Computation
  const productividadMecanicos = mecanicos.map((mec) => {
    const ordenesAsignadas = ordenes.filter((o) => o.mecanico_id === mec.id);
    let horas = 0;
    let manoObra = 0;

    ordenes.forEach((o) => {
      (o.orden_servicio_servicios || []).forEach((s: any) => {
        const assignedMecId = s.mecanico_id || o.mecanico_id;
        if (assignedMecId === mec.id) {
          horas += Number(s.horas_labor || 1);
          manoObra += Number(s.precio_cobrado || 0);
        }
      });
    });

    const pct = Number(mec.comision_porcentaje || 25);
    const comisionDevengada = manoObra * (pct / 100);

    return {
      ...mec,
      ordenesCount: ordenesAsignadas.length,
      activasCount: ordenesAsignadas.filter((o) => o.sub_estado !== "Entregado")
        .length,
      horas,
      manoObra,
      pct,
      comisionDevengada,
    };
  });

  // Filtered Orders for Live Shop Floor Table
  const filteredOrdenes = ordenes.filter((o) => {
    if (filterEstado === "Activas" && o.sub_estado === "Entregado") return false;
    if (
      filterEstado === "Por Cobrar" &&
      o.saldo <= 0 &&
      o.estatus_pago === "Pagado"
    )
      return false;
    if (
      filterEstado === "Listos" &&
      o.estado !== "Listo para Entrega"
    )
      return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const folioStr = `os-${o.folio || ""} #${1000 + Number(o.folio || 1)}`.toLowerCase();
    const vehStr =
      `${o.vehiculos?.marca || ""} ${o.vehiculos?.modelo || ""} ${o.vehiculos?.placas || ""}`.toLowerCase();
    const cliStr = `${o.vehiculos?.clientes?.nombre || ""}`.toLowerCase();
    const bahiaStr = `${o.bahia_rampa || ""}`.toLowerCase();
    return (
      folioStr.includes(q) ||
      vehStr.includes(q) ||
      cliStr.includes(q) ||
      bahiaStr.includes(q)
    );
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "Citas del Día":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "En Inspección":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "En Rampa":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Listo para Entrega":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center min-h-[450px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-slate-500 font-medium text-sm">
          Sincronizando piso de taller y métricas operativas...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xl">
            <Activity size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                {empresa?.nombre_comercial || "Torque & Ruta - Centro Automotriz"}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-white">
                <Building2 size={12} />
                {sucursalActiva
                  ? `${sucursalActiva.codigo} • ${sucursalActiva.nombre}`
                  : "Todas las Sucursales"}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5 font-medium">
               Torre de Control Shopmonkey • Rampas en vivo, ARO, comisiones de técnicos y cartera diferida
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/tablero?nuevaOrden=1"
            className="bg-primary hover:opacity-95 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus size={16} strokeWidth={2.5} />
            Nueva Orden
          </Link>
          <Link
            href="/tablero"
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Wrench size={15} />
            Ir al Workflow
          </Link>
          <Link
            href="/caja"
            className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Landmark size={15} className="text-emerald-600" />
            Corte de Caja
          </Link>
        </div>
      </div>

      {/* 6 High-Density Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Ventas Totales en Órdenes Activas */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Ventas en Piso Activo
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-900 tabular-nums">
              ${ventasTotalesActivas.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Total acumulado: ${ventasTotalesGlobal.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* 2. ARO / Ticket Promedio */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ARO (Ticket Promedio)
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Gauge size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-900 tabular-nums">
              ${aroTicketPromedio.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Promedio en {ordenes.length} órdenes registradas
            </p>
          </div>
        </div>

        {/* 3. Ingresos Cobrados vs Por Cobrar */}
        <Link
          href="/caja"
          className="bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-700">
              Cobrado vs. Por Cobrar
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-emerald-600 tabular-nums">
              ${totalCobrado.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[11px] text-rose-600 font-bold mt-1 tabular-nums">
              Por cobrar: ${totalPorCobrar.toLocaleString("es-MX", { maximumFractionDigits: 0 })} →
            </p>
          </div>
        </Link>

        {/* 4. Vehículos en Taller Breakdown */}
        <Link
          href="/tablero"
          className="bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Vehículos en Taller
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CarFront size={16} />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 tabular-nums">
              {ordenesActivas.length} unidades
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] font-bold">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                Citas: {countCitas}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Insp: {countInspeccion}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                Rampa: {countEnRampa}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Listos: {countListos}
              </span>
            </div>
          </div>
        </Link>

        {/* 5. Horas de Mano de Obra Facturadas */}
        <Link
          href="/caja?tab=Comisiones"
          className="bg-white border border-slate-200 hover:border-purple-300 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Horas MO Facturadas
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-900 tabular-nums">
              {horasFacturadas.toFixed(1)} hrs
            </h3>
            <p className="text-[11px] text-purple-600 font-bold mt-1">
              {mecanicos.length} técnicos activos →
            </p>
          </div>
        </Link>

        {/* 6. Cartera en Trabajos Diferidos */}
        <div className="bg-white border border-amber-200/80 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Trabajos Diferidos
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-amber-700 tabular-nums">
              ${carteraDiferidos.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {diferidos.length} reparaciones por recuperar
            </p>
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left (2/3 width): Bahías y Órdenes en Piso (Live Shop Floor Table) */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Wrench size={18} className="text-primary" />
                Bahías y Órdenes en Piso ({filteredOrdenes.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Haz clic en cualquier orden para abrir su Expediente Operativo o Portal Digital
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar folio, placas, cliente..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary w-48"
                />
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                {["Activas", "Listos", "Por Cobrar", "Todas"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterEstado(tab)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      filterEstado === tab
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Folio / Rampa</th>
                  <th className="py-3 px-4">Vehículo / Cliente</th>
                  <th className="py-3 px-4">Técnico</th>
                  <th className="py-3 px-4">Estado Workflow</th>
                  <th className="py-3 px-4 text-right">Total / Pago</th>
                  <th className="py-3 px-4 text-right">Acciones Directas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredOrdenes.map((o) => {
                  const veh = o.vehiculos;
                  const cli = veh?.clientes;
                  const mec = o.mecanico;

                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-slate-50/90 transition-colors group"
                    >
                      {/* Folio & Rampa */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Link
                          href={`/tablero?ordenId=${o.id}`}
                          className="font-bold text-slate-900 hover:text-primary flex items-center gap-1 font-mono"
                        >
                          #{1000 + Number(o.folio || 1)}
                        </Link>
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {o.bahia_rampa || "Sin Rampa"}
                        </span>
                      </td>

                      {/* Vehículo + Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {veh?.marca} {veh?.modelo} {veh?.anio || ""}
                          <span className="ml-1.5 text-xs font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                            {veh?.placas}
                          </span>
                        </div>
                        {cli ? (
                          <Link
                            href={`/clientes/${cli.id}`}
                            className="text-xs text-slate-500 hover:text-primary hover:underline font-medium mt-0.5 inline-block"
                          >
                            {cli.nombre}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">Sin cliente</span>
                        )}
                      </td>

                      {/* Técnico */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {mec ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: mec.color_avatar || "#2563EB",
                              }}
                            >
                              {mec.nombre.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                {mec.nombre}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {o.totalHoras} hrs
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Sin asignar
                          </span>
                        )}
                      </td>

                      {/* Estado Workflow */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getEstadoBadge(
                            o.estado
                          )}`}
                        >
                          {o.estado}
                        </span>
                        {o.sub_estado && (
                          <p className="text-[10px] text-slate-500 font-medium mt-1">
                            {o.sub_estado}
                          </p>
                        )}
                      </td>

                      {/* Total / Pago */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-bold text-slate-900 tabular-nums">
                          $
                          {o.granTotal.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <span
                          className={`inline-block mt-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            o.estatus_pago === "Pagado"
                              ? "bg-emerald-100 text-emerald-700"
                              : o.estatus_pago === "Parcial"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {o.estatus_pago}
                          {o.saldo > 0
                            ? ` (Debe $${o.saldo.toLocaleString("es-MX", {
                                maximumFractionDigits: 0,
                              })})`
                            : ""}
                        </span>
                      </td>

                      {/* Acciones Directas */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/tablero?ordenId=${o.id}`}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-primary text-white text-xs font-bold transition-colors inline-flex items-center gap-1"
                          >
                            Expediente <ArrowRight size={12} />
                          </Link>
                          <Link
                            href={`/orden/${o.id}`}
                            target="_blank"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors inline-flex items-center gap-1"
                            title="Abrir Portal Digital del Cliente (DVI)"
                          >
                            Portal <ExternalLink size={11} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrdenes.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No se encontraron órdenes con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right (1/3 width): Productividad de Técnicos & Alertas de Retorno */}
        <div className="flex flex-col gap-6">
          {/* Productividad por Mecánico */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck size={16} className="text-primary" />
                  Productividad de Técnicos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Horas facturadas y comisión acumulada
                </p>
              </div>
              <Link
                href="/caja?tab=Comisiones"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                Nómina <ArrowRight size={12} />
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              {productividadMecanicos.map((m) => (
                <Link
                  key={m.id}
                  href="/caja?tab=Comisiones"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-primary/50 hover:bg-slate-50/70 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: m.color_avatar || "#2563EB" }}
                    >
                      {m.nombre
                        .split(" ")
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {m.nombre}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {m.especialidad || "Mecánica General"} • {m.ordenesCount}{" "}
                        órdenes ({m.horas.toFixed(1)} hrs)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500">
                      MO: ${m.manoObra.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-sm font-bold text-emerald-600 tabular-nums">
                      Com ({m.pct}%): $
                      {m.comisionDevengada.toLocaleString("es-MX", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Oportunidades de Retorno (Trabajos Diferidos) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600" />
                  Oportunidades de Retorno ({diferidos.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Trabajos diferidos en inspecciones previas listos para seguimiento
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {diferidos.map((d) => {
                const phoneClean = (d.clientes?.telefono || "").replace(/\D/g, "");
                const waText = encodeURIComponent(
                  `Hola ${d.clientes?.nombre || ""}, te escribimos de ${
                    empresa?.nombre_comercial || "Torque & Ruta"
                  } para recordarte el servicio pendiente de tu ${
                    d.vehiculos?.marca || ""
                  } ${d.vehiculos?.modelo || ""} (${d.concepto}). ¿Te gustaría agendar cita esta semana?`
                );

                return (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-amber-50/20 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded mb-1 ${
                            d.severidad === "Urgente"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {d.severidad} • {d.categoria}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">
                          {d.concepto}
                        </h4>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                          {d.vehiculos?.marca} {d.vehiculos?.modelo} (
                          {d.vehiculos?.placas}) • {d.clientes?.nombre}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                        $
                        {Number(d.costo_estimado || 0).toLocaleString("es-MX", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                      <Link
                        href={`/clientes/${d.cliente_id}?vehiculoId=${d.vehiculo_id}`}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        Ver Expediente Cliente <ArrowRight size={12} />
                      </Link>
                      {phoneClean && (
                        <a
                          href={`https://wa.me/52${phoneClean}?text=${waText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <MessageCircle size={12} /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}

              {diferidos.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No hay trabajos diferidos pendientes de seguimiento.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
