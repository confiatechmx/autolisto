"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/context/TenantContext";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  Banknote,
  Wrench,
  Package,
  Calendar,
  Download,
  Printer,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  Award,
} from "lucide-react";

type DateRange = "7d" | "30d" | "month" | "last_month" | "year";

const PIE_COLORS = ["#0284c7", "#10b981", "#f59e0b", "#6366f1"];

export default function ReportesPage() {
  const supabase = createClient();
  const { empresa, sucursalActiva, sucursales } = useTenant();

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [diferidos, setDiferidos] = useState<any[]>([]);
  const [mecanicos, setMecanicos] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
    if (sucursalActiva?.id) {
      setSelectedBranchId(sucursalActiva.id);
    }
  }, [sucursalActiva]);

  // Load analytics dataset
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders with details
      let ordQuery = supabase
        .from("ordenes_servicio")
        .select(`
          id,
          folio,
          sucursal_id,
          estado,
          sub_estado,
          fecha_ingreso,
          mecanico_id,
          vehiculos ( marca, modelo, anio ),
          mecanico:empleados!ordenes_servicio_mecanico_id_fkey ( id, nombre ),
          orden_servicio_servicios (
            id, precio_cobrado, horas_labor, mecanico_id, estatus_aprobacion,
            servicios_taller ( nombre, categoria )
          ),
          orden_servicio_refacciones (
            id, cantidad, precio_unitario, subtotal, descripcion, estatus_aprobacion
          ),
          cotizaciones (
            id,
            detalles_cotizacion ( descripcion, subtotal, estatus_aprobacion )
          )
        `);

      if (selectedBranchId !== "all") {
        ordQuery = ordQuery.eq("sucursal_id", selectedBranchId);
      }

      // 2. Fetch Payments
      let payQuery = supabase
        .from("pagos_orden")
        .select(`
          id,
          orden_servicio_id,
          sucursal_id,
          monto_total,
          proveedor_pago,
          metodo_detalle,
          fecha_pago,
          estatus,
          comision_pasarela,
          deleted_at
        `)
        .eq("estatus", "Aprobado")
        .is("deleted_at", null);

      if (selectedBranchId !== "all") {
        payQuery = payQuery.eq("sucursal_id", selectedBranchId);
      }

      // 3. Fetch Deferred items
      let difQuery = supabase
        .from("trabajos_diferidos")
        .select(`id, orden_id, costo_estimado, severidad, categoria, resuelto, created_at`);

      // 4. Fetch Mechanics
      const mecQuery = supabase
        .from("empleados")
        .select("id, nombre, comision_porcentaje, tarifa_hora, rol")
        .eq("rol", "Mecánico")
        .eq("activo", true);

      const [ordRes, payRes, difRes, mecRes] = await Promise.all([
        ordQuery,
        payQuery,
        difQuery,
        mecQuery,
      ]);

      if (ordRes.data) setOrdenes(ordRes.data);
      if (payRes.data) setPagos(payRes.data);
      if (difRes.data) setDiferidos(difRes.data);
      if (mecRes.data) setMecanicos(mecRes.data);
    } catch (err) {
      console.error("Error cargando analítica:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Date Range Filtering
  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate = new Date();

    if (dateRange === "7d") {
      startDate.setDate(now.getDate() - 7);
    } else if (dateRange === "30d") {
      startDate.setDate(now.getDate() - 30);
    } else if (dateRange === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === "last_month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else if (dateRange === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const filteredOrders = ordenes.filter((o) => {
      const d = new Date(o.fecha_ingreso);
      return d >= startDate && d <= now;
    });

    const filteredPayments = pagos.filter((p) => {
      const d = new Date(p.fecha_pago);
      return d >= startDate && d <= now;
    });

    const filteredDeferred = diferidos.filter((d) => {
      const dt = new Date(d.created_at);
      return dt >= startDate && dt <= now;
    });

    return {
      orders: filteredOrders,
      payments: filteredPayments,
      deferred: filteredDeferred,
    };
  }, [ordenes, pagos, diferidos, dateRange]);

  // Aggregate Core Financial Metrics
  const metrics = useMemo(() => {
    const { orders, payments, deferred } = filteredData;

    let totalManoObra = 0;
    let totalRefacciones = 0;
    let totalLlantas = 0;
    let totalHoras = 0;

    let serviciosAprobados = 0;
    let serviciosDiferidos = 0;

    const topItemsMap: Record<string, { tipo: string; count: number; total: number }> = {};

    orders.forEach((o) => {
      // Labor Services
      (o.orden_servicio_servicios || []).forEach((s: any) => {
        if (s.estatus_aprobacion === "Diferido") {
          serviciosDiferidos++;
        } else {
          serviciosAprobados++;
          const price = Number(s.precio_cobrado || 0);
          totalManoObra += price;
          totalHoras += Number(s.horas_labor || 1);

          const srvName = s.servicios_taller?.nombre || "Mano de Obra General";
          if (!topItemsMap[srvName]) {
            topItemsMap[srvName] = { tipo: "Servicio", count: 0, total: 0 };
          }
          topItemsMap[srvName].count++;
          topItemsMap[srvName].total += price;
        }
      });

      // Parts / Refacciones
      (o.orden_servicio_refacciones || []).forEach((r: any) => {
        if (r.estatus_aprobacion !== "Diferido") {
          const qty = Number(r.cantidad || 1);
          const sub = Number(r.subtotal ?? qty * Number(r.precio_unitario || 0));
          totalRefacciones += sub;

          const desc = r.descripcion || "Refacción / Repuesto";
          if (!topItemsMap[desc]) {
            topItemsMap[desc] = { tipo: "Refacción", count: 0, total: 0 };
          }
          topItemsMap[desc].count += qty;
          topItemsMap[desc].total += sub;
        }
      });

      // Tires / Llantas
      const cotList = Array.isArray(o.cotizaciones)
        ? o.cotizaciones
        : o.cotizaciones
        ? [o.cotizaciones]
        : [];
      cotList.forEach((c: any) => {
        (c.detalles_cotizacion || []).forEach((det: any) => {
          if (det.estatus_aprobacion !== "Diferido") {
            const sub = Number(det.subtotal || 0);
            totalLlantas += sub;

            const desc = det.descripcion || "Neumático";
            if (!topItemsMap[desc]) {
              topItemsMap[desc] = { tipo: "Llanta", count: 0, total: 0 };
            }
            topItemsMap[desc].count++;
            topItemsMap[desc].total += sub;
          }
        });
      });
    });

    const totalVendido = totalManoObra + totalRefacciones + totalLlantas;
    const totalCobrado = payments.reduce((acc, p) => acc + Number(p.monto_total || 0), 0);
    const totalComisionesPasarela = payments.reduce(
      (acc, p) => acc + Number(p.comision_pasarela || 0),
      0
    );
    const cobranzaNeta = totalCobrado - totalComisionesPasarela;

    const aro = orders.length > 0 ? totalVendido / orders.length : 0;

    // Gross Margin approximation: Labor 85%, Parts 35%, Tires 25%
    const estimatedMargin =
      totalVendido > 0
        ? (totalManoObra * 0.85 + totalRefacciones * 0.35 + totalLlantas * 0.25) / totalVendido
        : 0;

    const carteraDiferidaMonto = deferred.reduce(
      (acc, d) => acc + Number(d.costo_estimado || 0),
      0
    );

    const conversionDvi =
      serviciosAprobados + serviciosDiferidos > 0
        ? (serviciosAprobados / (serviciosAprobados + serviciosDiferidos)) * 100
        : 80;

    const sortedTopItems = Object.entries(topItemsMap)
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return {
      totalVendido,
      totalCobrado,
      cobranzaNeta,
      totalComisionesPasarela,
      totalManoObra,
      totalRefacciones,
      totalLlantas,
      totalHoras,
      aro,
      ordersCount: orders.length,
      estimatedMargin,
      carteraDiferidaMonto,
      deferredCount: deferred.length,
      conversionDvi,
      sortedTopItems,
    };
  }, [filteredData]);

  // Temporal Trend Chart Data (Grouped by Date)
  const temporalTrendData = useMemo(() => {
    const { orders, payments } = filteredData;
    const dateMap: Record<string, { fecha: string; ventas: number; cobrado: number }> = {};

    orders.forEach((o) => {
      const dateKey = new Date(o.fecha_ingreso).toLocaleDateString("es-MX", {
        month: "short",
        day: "numeric",
      });
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { fecha: dateKey, ventas: 0, cobrado: 0 };
      }
      const srv = (o.orden_servicio_servicios || []).reduce(
        (a: number, s: any) => a + Number(s.precio_cobrado || 0),
        0
      );
      const ref = (o.orden_servicio_refacciones || []).reduce(
        (a: number, r: any) =>
          a + Number(r.subtotal ?? Number(r.cantidad || 1) * Number(r.precio_unitario || 0)),
        0
      );
      dateMap[dateKey].ventas += srv + ref;
    });

    payments.forEach((p) => {
      const dateKey = new Date(p.fecha_pago).toLocaleDateString("es-MX", {
        month: "short",
        day: "numeric",
      });
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { fecha: dateKey, ventas: 0, cobrado: 0 };
      }
      dateMap[dateKey].cobrado += Number(p.monto_total || 0);
    });

    return Object.values(dateMap).slice(-14);
  }, [filteredData]);

  // Revenue Mix Chart Data
  const revenueMixData = useMemo(() => {
    return [
      { name: "Mano de Obra", value: Math.round(metrics.totalManoObra) },
      { name: "Refacciones", value: Math.round(metrics.totalRefacciones) },
      { name: "Llantas y Rines", value: Math.round(metrics.totalLlantas) },
    ].filter((item) => item.value > 0);
  }, [metrics]);

  // Mechanic Productivity Chart Data
  const mechanicChartData = useMemo(() => {
    const { orders } = filteredData;

    return mecanicos.map((mec) => {
      let horas = 0;
      let totalVendidoMec = 0;

      orders.forEach((o) => {
        (o.orden_servicio_servicios || []).forEach((s: any) => {
          const assignedId = s.mecanico_id || o.mecanico_id;
          if (assignedId === mec.id && s.estatus_aprobacion !== "Diferido") {
            horas += Number(s.horas_labor || 1);
            totalVendidoMec += Number(s.precio_cobrado || 0);
          }
        });
      });

      const comision = totalVendidoMec * (Number(mec.comision_porcentaje || 25) / 100);

      return {
        nombre: mec.nombre.split(" ")[0],
        horas,
        manoObra: Math.round(totalVendidoMec),
        comision: Math.round(comision),
      };
    });
  }, [filteredData, mecanicos]);

  // Payment Provider Breakdown
  const paymentProviderStats = useMemo(() => {
    const { payments } = filteredData;
    const map: Record<string, { count: number; total: number }> = {};

    payments.forEach((p) => {
      const prov = p.proveedor_pago || "Efectivo";
      if (!map[prov]) map[prov] = { count: 0, total: 0 };
      map[prov].count++;
      map[prov].total += Number(p.monto_total || 0);
    });

    return Object.entries(map).map(([proveedor, data]) => ({
      proveedor,
      ...data,
    }));
  }, [filteredData]);

  // Export CSV
  const handleExportCSV = () => {
    const { orders } = filteredData;
    const headers = ["Folio,Fecha,Vehiculo,Total_ManoObra,Total_Refacciones,GranTotal,Estatus"];
    const rows = orders.map((o) => {
      const srv = (o.orden_servicio_servicios || []).reduce(
        (a: number, s: any) => a + Number(s.precio_cobrado || 0),
        0
      );
      const ref = (o.orden_servicio_refacciones || []).reduce(
        (a: number, r: any) =>
          a + Number(r.subtotal ?? Number(r.cantidad || 1) * Number(r.precio_unitario || 0)),
        0
      );
      const veh = o.vehiculos ? `${o.vehiculos.marca} ${o.vehiculos.modelo}` : "N/A";
      return `#${1000 + Number(o.folio || 1)},"${new Date(o.fecha_ingreso).toISOString().slice(0, 10)}","${veh}",${srv},${ref},${srv + ref},"${o.estado}"`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_financiero_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-screen p-4 md:p-6 lg:p-8 space-y-6 print:p-0 print:bg-white">
      {/* ─── Top Control Bar: Title, Filters & Actions ───────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-sky-600" />
              Reportes Gerenciales y Analítica (BI)
            </h1>
            <span className="bg-sky-100 text-sky-800 text-[11px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              ShopMonkey Insights
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Métricas de facturación real, rentabilidad de mano de obra vs refacciones, conversión DVI y nómina de comisiones.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Filter */}
          {sucursales && sucursales.length > 1 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-2xs text-xs font-semibold">
              <Building2 size={14} className="text-slate-500" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">Todas las Sucursales</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Selector Pills */}
          <div className="flex items-center bg-white border border-slate-300 rounded-lg p-1 shadow-2xs text-xs font-bold text-slate-600">
            <button
              onClick={() => setDateRange("7d")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                dateRange === "7d" ? "bg-slate-900 text-white font-extrabold" : "hover:text-slate-900"
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setDateRange("30d")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                dateRange === "30d" ? "bg-slate-900 text-white font-extrabold" : "hover:text-slate-900"
              }`}
            >
              30 Días
            </button>
            <button
              onClick={() => setDateRange("month")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                dateRange === "month" ? "bg-slate-900 text-white font-extrabold" : "hover:text-slate-900"
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setDateRange("year")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                dateRange === "year" ? "bg-slate-900 text-white font-extrabold" : "hover:text-slate-900"
              }`}
            >
              Año Actual
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={fetchReportData}
            title="Refrescar datos"
            className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-sky-600" : ""} />
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Excel / CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Printer size={14} />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {/* ─── Row 1: Executive KPI Scorecard Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Ventas Totales */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ventas Facturadas</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-slate-900 tabular-nums">
            ${metrics.totalVendido.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="font-bold text-slate-800">{metrics.ordersCount}</span> órdenes cerradas
          </div>
        </div>

        {/* KPI 2: Flujo Cobrado */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cobranza en Caja</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote size={15} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-600 tabular-nums">
            ${metrics.totalCobrado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="font-bold text-slate-700">${metrics.cobranzaNeta.toLocaleString("es-MX")}</span> neto tras pasarelas
          </div>
        </div>

        {/* KPI 3: ARO (Ticket Promedio) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ticket Promedio (ARO)</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award size={15} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-purple-700 tabular-nums">
            ${Math.round(metrics.aro).toLocaleString("es-MX")}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>Average Repair Order</span>
          </div>
        </div>

        {/* KPI 4: Margen Bruto Estimado */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Margen Bruto Est.</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowUpRight size={15} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-slate-900 tabular-nums">
            {Math.round(metrics.estimatedMargin * 100)}%
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="font-bold text-emerald-600">Alta rentabilidad</span> en M.O.
          </div>
        </div>

        {/* KPI 5: Cartera Diferida Rescatable */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cartera Diferida</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-rose-600 tabular-nums">
            ${metrics.carteraDiferidaMonto.toLocaleString("es-MX")}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="font-bold text-slate-800">{metrics.deferredCount}</span> servicios para remarketing
          </div>
        </div>
      </div>

      {/* ─── Row 2: Charts (Ventas vs Cobranza + Mix de Facturación) ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Curva Temporal Ventas vs Flujo Cobrado (8 Cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Evolución de Facturación vs Flujo de Cobranza en Caja
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Compara el volumen presupuestado/facturado contra los abonos y liquidaciones en efectivo y terminal.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-sky-600">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                Ventas Facturadas
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Cobrado en Caja
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {isMounted && temporalTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={temporalTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCobrado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(value: any) => [`$${Number(value).toLocaleString("es-MX")}`, ""]}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      color: "#fff",
                      borderRadius: "8px",
                      fontSize: "12px",
                      border: "none",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    name="Facturado"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorVentas)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cobrado"
                    name="Cobrado"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCobrado)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sin movimientos en este período seleccionado.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Mix de Facturación (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Mix de Facturación del Taller
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Participación porcentual de Mano de Obra vs Refacciones vs Llantas.
            </p>
          </div>

          <div className="h-52 w-full my-auto flex items-center justify-center">
            {isMounted && revenueMixData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueMixData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {revenueMixData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => `$${Number(val).toLocaleString("es-MX")}`}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      color: "#fff",
                      borderRadius: "8px",
                      fontSize: "11px",
                      border: "none",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Sin datos de facturación</div>
            )}
          </div>

          {/* Custom Detailed Legend */}
          <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
                Mano de Obra (Servicios)
              </span>
              <span className="font-bold text-slate-900 tabular-nums">
                ${metrics.totalManoObra.toLocaleString("es-MX")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Refacciones y Autopartes
              </span>
              <span className="font-bold text-slate-900 tabular-nums">
                ${metrics.totalRefacciones.toLocaleString("es-MX")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Neumáticos y Llantas
              </span>
              <span className="font-bold text-slate-900 tabular-nums">
                ${metrics.totalLlantas.toLocaleString("es-MX")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Row 3: Productividad Mecánicos & Funnel DVI ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Productividad y Comisiones por Técnico (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-sky-600" />
                Horas Vendidas y Comisiones por Técnico
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Eficiencia en mano de obra cobrada y nómina devengada por mecánico.
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            {isMounted && mechanicChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mechanicChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="nombre" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      name === "Horas" ? `${val} hrs` : `$${Number(val).toLocaleString("es-MX")}`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      color: "#fff",
                      borderRadius: "8px",
                      fontSize: "12px",
                      border: "none",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Bar dataKey="manoObra" name="Mano de Obra Vendida" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comision" name="Comisión Devengada" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sin registros de técnicos en este período
              </div>
            )}
          </div>
        </div>

        {/* Funnel DVI & Inspección Digital (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Efectividad de Conversión DVI
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tasa de aceptación en patio de los presupuestos generados en la inspección multipunto.
            </p>
          </div>

          <div className="space-y-4 my-auto py-3">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                <span>Tasa de Conversión Digital</span>
                <span className="text-emerald-600">{Math.round(metrics.conversionDvi)}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${metrics.conversionDvi}%` }}
                  className="bg-emerald-500 h-full rounded-full transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[10px] font-bold uppercase text-slate-400">Horas Taller Vendidas</div>
                <div className="text-lg font-black text-slate-900 tabular-nums">
                  {metrics.totalHoras.toFixed(1)} hrs
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Capacidad productiva</div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <div className="text-[10px] font-bold uppercase text-rose-700">Trabajos Diferidos</div>
                <div className="text-lg font-black text-rose-700 tabular-nums">
                  ${metrics.carteraDiferidaMonto.toLocaleString("es-MX")}
                </div>
                <div className="text-[10px] text-rose-600 mt-0.5">Potencial de rescate</div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg text-xs text-sky-800 flex items-start gap-2">
            <span className="font-bold">Tip de Operación:</span> Los clientes que reciben el link interactivo DVI con fotos por WhatsApp aumentan la tasa de aprobación de refacciones en un 38%.
          </div>
        </div>
      </div>

      {/* ─── Row 4: Top 8 Best-Selling Services & Parts ──────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Top Servicios y Refacciones con Mayor Facturación
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Los conceptos que generan mayor volumen de ingresos en el período.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {metrics.sortedTopItems.length} ítems principales
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] uppercase font-bold text-slate-500">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Concepto</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-center">Unidades / Servicios</th>
                <th className="py-3 px-4 text-right">Facturación Generada</th>
                <th className="py-3 px-4 text-right">% del Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.sortedTopItems.map((item, idx) => {
                const pct = metrics.totalVendido > 0 ? (item.total / metrics.totalVendido) * 100 : 0;
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.nombre}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.tipo === "Servicio"
                            ? "bg-sky-100 text-sky-800"
                            : item.tipo === "Llanta"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.tipo}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700 tabular-nums">
                      {item.count}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 tabular-nums">
                      ${item.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-500 tabular-nums">
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Row 5: Pasarelas y Métodos de Cobro en Caja ──────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
          Distribución de Cobranza por Pasarela y Método
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Auditoría de ingresos en caja según canal físico (efectivo, TPV) o digital (Stripe, SPEI, BNPL).
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {paymentProviderStats.map((p, i) => (
            <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
              <div className="text-[11px] font-bold text-slate-700 truncate">{p.proveedor}</div>
              <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                ${p.total.toLocaleString("es-MX")}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{p.count} transacciones</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
