"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/context/TenantContext";
import Link from "next/link";
import {
  Loader2,
  Landmark,
  Banknote,
  CreditCard,
  ArrowRight,
  Plus,
  XCircle,
  CheckCircle2,
  Wallet,
  Wrench,
  Clock,
  Receipt,
  Building2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

type TabType = "Cobranza" | "CajaChica" | "Comisiones";

export default function CajaPage() {
  const supabase = createClient();
  const { empresa, sucursalActiva, sucursales } = useTenant();

  const [activeTab, setActiveTab] = useState<TabType>("Cobranza");
  const [loading, setLoading] = useState(true);

  // Data States
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [movimientosCaja, setMovimientosCaja] = useState<any[]>([]);
  const [mecanicos, setMecanicos] = useState<any[]>([]);
  const [configPagos, setConfigPagos] = useState<any[]>([]);

  // Modal: Cobrar Ahora (Inline Payment Modal)
  const [cobroOrden, setCobroOrden] = useState<any | null>(null);
  const [cobroMonto, setCobroMonto] = useState<string>("");
  const [cobroProveedor, setCobroProveedor] = useState<
    "Efectivo" | "Transferencia" | "Mercado Pago" | "Stripe"
  >("Efectivo");
  const [cobroDetalle, setCobroDetalle] = useState<string>("Efectivo en Caja");
  const [cobroReferencia, setCobroReferencia] = useState<string>("");
  const [savingCobro, setSavingCobro] = useState(false);

  // Modal: Cancelar Pago (Audited Soft-Delete)
  const [cancelPago, setCancelPago] = useState<any | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [savingCancel, setSavingCancel] = useState(false);

  // Modal: Registrar Movimiento de Caja Chica
  const [isCajaModalOpen, setIsCajaModalOpen] = useState(false);
  const [movForm, setMovForm] = useState({
    tipo: "Gasto / Insumos",
    concepto: "",
    monto: "",
    metodo: "Efectivo",
    responsable: "Alejandro Villarreal",
  });
  const [savingMov, setSavingMov] = useState(false);

  // Selected mechanic filter in Tab 3
  const [selectedMecanicoId, setSelectedMecanicoId] = useState<string>("ALL");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "Comisiones" || tabParam === "CajaChica" || tabParam === "Cobranza") {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let ordQuery = supabase
        .from("ordenes_servicio")
        .select(`
          id,
          folio,
          sucursal_id,
          estado,
          estatus_pago,
          mecanico_id,
          fecha_ingreso,
          vehiculos ( id, marca, modelo, anio, placas, clientes ( id, nombre, telefono ) ),
          orden_servicio_servicios (
            id,
            precio_cobrado,
            horas_labor,
            mecanico_id,
            comision_porcentaje,
            estatus_aprobacion,
            servicios_taller ( nombre, categoria )
          ),
          orden_servicio_refacciones (
            id,
            cantidad,
            precio_unitario,
            subtotal
          ),
          cotizaciones (
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

      let pagosQuery = supabase
        .from("pagos_orden")
        .select(`
          id,
          orden_servicio_id,
          sucursal_id,
          monto_total,
          proveedor_pago,
          metodo_detalle,
          referencia,
          estatus,
          comision_pasarela,
          fecha_pago,
          deleted_at,
          motivo_cancelacion,
          ordenes_servicio (
            id,
            folio,
            vehiculos ( marca, modelo, placas, clientes ( nombre ) )
          )
        `)
        .order("fecha_pago", { ascending: false });

      let movQuery = supabase
        .from("caja_movimientos")
        .select("*")
        .order("created_at", { ascending: false });

      if (sucursalActiva) {
        ordQuery = ordQuery.eq("sucursal_id", sucursalActiva.id);
        pagosQuery = pagosQuery.eq("sucursal_id", sucursalActiva.id);
        movQuery = movQuery.eq("sucursal_id", sucursalActiva.id);
      }

      const [ordRes, pagRes, movRes, empRes, cfgRes] = await Promise.all([
        ordQuery,
        pagosQuery,
        movQuery,
        supabase
          .from("empleados")
          .select("*")
          .eq("rol", "Mecánico")
          .order("nombre"),
        supabase.from("configuracion_pagos").select("*"),
      ]);

      if (ordRes.data) {
        const enriched = ordRes.data.map((order: any) => {
          const srvTotal = (order.orden_servicio_servicios || [])
            .filter((s: any) => s.estatus_aprobacion !== "Diferido")
            .reduce(
              (acc: number, curr: any) => acc + Number(curr.precio_cobrado || 0),
              0
            );
          const refTotal = (order.orden_servicio_refacciones || [])
            .filter((r: any) => r.estatus_aprobacion !== "Diferido")
            .reduce(
              (acc: number, curr: any) =>
                acc +
                Number(
                  curr.subtotal ??
                    Number(curr.cantidad || 1) * Number(curr.precio_unitario || 0)
                ),
              0
            );
          const cotList = Array.isArray(order.cotizaciones)
            ? order.cotizaciones
            : order.cotizaciones
            ? [order.cotizaciones]
            : [];
          const llantasTotal = cotList
            .flatMap((c: any) => c.detalles_cotizacion || [])
            .filter((l: any) => l.estatus_aprobacion !== "Diferido")
            .reduce((acc: number, curr: any) => acc + Number(curr.subtotal || 0), 0);

          const granTotal = srvTotal + refTotal + llantasTotal;

          const pagado = (order.pagos_orden || [])
            .filter((p: any) => p.estatus === "Aprobado" && !p.deleted_at)
            .reduce((acc: number, curr: any) => acc + Number(curr.monto_total || 0), 0);

          const saldo = Math.max(0, granTotal - pagado);

          return {
            ...order,
            srvTotal,
            refTotal,
            llantasTotal,
            granTotal,
            pagado,
            saldo,
          };
        });
        setOrdenes(enriched);
      }

      if (pagRes.data) setPagos(pagRes.data);
      if (movRes.data) setMovimientosCaja(movRes.data);
      if (empRes.data) setMecanicos(empRes.data);
      if (cfgRes.data) setConfigPagos(cfgRes.data);
    } catch (err) {
      console.error("Error loading Caja data:", err);
    } finally {
      setLoading(false);
    }
  }, [sucursalActiva]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Calculations for Tab 1: Cobranza y Corte ---
  const pagosActivos = pagos.filter(
    (p) => p.estatus === "Aprobado" && !p.deleted_at
  );

  const cobrosEfectivo = pagosActivos
    .filter((p) => p.proveedor_pago === "Efectivo")
    .reduce((acc, p) => acc + Number(p.monto_total || 0), 0);

  const cobrosTransferencia = pagosActivos
    .filter((p) => p.proveedor_pago === "Transferencia")
    .reduce((acc, p) => acc + Number(p.monto_total || 0), 0);

  const cobrosTPV = pagosActivos
    .filter(
      (p) =>
        p.proveedor_pago === "Mercado Pago" || p.proveedor_pago === "Stripe"
    )
    .reduce((acc, p) => acc + Number(p.monto_total || 0), 0);

  const comisionesPasarelaTotal = pagosActivos.reduce(
    (acc, p) => acc + Number(p.comision_pasarela || 0),
    0
  );

  const totalBrutoCobrado =
    cobrosEfectivo + cobrosTransferencia + cobrosTPV;
  const totalNetoCobrado = totalBrutoCobrado - comisionesPasarelaTotal;

  // Petty Cash (Caja Chica) impact on Physical Cash Drawer
  const entradasCajaEfectivo = movimientosCaja
    .filter(
      (m) =>
        (m.tipo === "Fondo Inicial" || m.tipo === "Ingreso Extra") &&
        m.metodo === "Efectivo"
    )
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const salidasCajaEfectivo = movimientosCaja
    .filter(
      (m) =>
        (m.tipo === "Gasto / Insumos" || m.tipo === "Pago Proveedor") &&
        m.metodo === "Efectivo"
    )
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const efectivoEnGaveta =
    entradasCajaEfectivo + cobrosEfectivo - salidasCajaEfectivo;

  const cuentasPorCobrar = ordenes.filter((o) => o.saldo > 0.01);
  const totalPorCobrar = cuentasPorCobrar.reduce((acc, o) => acc + o.saldo, 0);

  // --- Handlers: Cobrar Ahora ---
  const openCobroModal = (orden: any) => {
    setCobroOrden(orden);
    setCobroMonto(orden.saldo.toFixed(2));
    setCobroProveedor("Efectivo");
    setCobroDetalle("Efectivo en Ventanilla");
    setCobroReferencia("");
  };

  const handleProveedorSelect = (
    prov: "Efectivo" | "Transferencia" | "Mercado Pago" | "Stripe"
  ) => {
    setCobroProveedor(prov);
    if (prov === "Efectivo") setCobroDetalle("Efectivo en Ventanilla");
    if (prov === "Transferencia") setCobroDetalle("SPEI Bancario");
    if (prov === "Mercado Pago") setCobroDetalle("Terminal Point Smart TPV");
    if (prov === "Stripe") setCobroDetalle("Tarjeta Crédito / Débito");
  };

  const handleConfirmarCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cobroOrden) return;
    const montoNum = parseFloat(cobroMonto);
    if (isNaN(montoNum) || montoNum <= 0) return;

    setSavingCobro(true);
    try {
      const cfg = configPagos.find((c) => c.proveedor === cobroProveedor);
      const pctComision = Number(cfg?.comision_porcentaje || 0);
      const comisionMonto = Number(((montoNum * pctComision) / 100).toFixed(2));

      const targetSucursalId =
        cobroOrden.sucursal_id ||
        sucursalActiva?.id ||
        sucursales[0]?.id ||
        "b0000000-0000-0000-0000-000000000001";

      await supabase.from("pagos_orden").insert({
        orden_servicio_id: cobroOrden.id,
        sucursal_id: targetSucursalId,
        monto_total: montoNum,
        proveedor_pago: cobroProveedor,
        metodo_detalle: cobroDetalle,
        referencia:
          cobroReferencia ||
          `AUT-${Math.floor(100000 + Math.random() * 900000)}`,
        estatus: "Aprobado",
        comision_pasarela: comisionMonto,
        fecha_pago: new Date().toISOString(),
      });

      const nuevoPagado = cobroOrden.pagado + montoNum;
      const nuevoEstatus =
        nuevoPagado >= cobroOrden.granTotal - 0.5 ? "Pagado" : "Parcial";

      await supabase
        .from("ordenes_servicio")
        .update({ estatus_pago: nuevoEstatus })
        .eq("id", cobroOrden.id);

      setCobroOrden(null);
      await loadData();
    } catch (err) {
      console.error("Error registrando pago:", err);
    } finally {
      setSavingCobro(false);
    }
  };

  // --- Handlers: Cancelar Pago (Soft Delete) ---
  const handleConfirmarCancelacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelPago || !motivoCancelacion.trim()) return;
    setSavingCancel(true);

    try {
      await supabase
        .from("pagos_orden")
        .update({
          deleted_at: new Date().toISOString(),
          motivo_cancelacion: motivoCancelacion.trim(),
        })
        .eq("id", cancelPago.id);

      // Recalculate order estatus_pago
      const ordId = cancelPago.orden_servicio_id;
      const targetOrder = ordenes.find((o) => o.id === ordId);
      if (targetOrder) {
        const remainingPaid = Math.max(
          0,
          targetOrder.pagado - Number(cancelPago.monto_total || 0)
        );
        const nextStatus =
          remainingPaid <= 0.01
            ? "Pendiente"
            : remainingPaid >= targetOrder.granTotal - 0.5
            ? "Pagado"
            : "Parcial";

        await supabase
          .from("ordenes_servicio")
          .update({ estatus_pago: nextStatus })
          .eq("id", ordId);
      }

      setCancelPago(null);
      setMotivoCancelacion("");
      await loadData();
    } catch (err) {
      console.error("Error cancelando pago:", err);
    } finally {
      setSavingCancel(false);
    }
  };

  // --- Handlers: Registrar Movimiento Caja Chica ---
  const handleSaveMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(movForm.monto);
    if (!movForm.concepto.trim() || isNaN(montoNum) || montoNum <= 0) return;

    setSavingMov(true);
    try {
      const targetSucursalId =
        sucursalActiva?.id ||
        sucursales[0]?.id ||
        "b0000000-0000-0000-0000-000000000001";

      await supabase.from("caja_movimientos").insert({
        empresa_id: empresa?.id || "a0000000-0000-0000-0000-000000000001",
        sucursal_id: targetSucursalId,
        tipo: movForm.tipo,
        concepto: movForm.concepto.trim(),
        monto: montoNum,
        metodo: movForm.metodo,
        responsable: movForm.responsable.trim() || "Administrador",
      });

      setIsCajaModalOpen(false);
      setMovForm({
        tipo: "Gasto / Insumos",
        concepto: "",
        monto: "",
        metodo: "Efectivo",
        responsable: "Alejandro Villarreal",
      });
      await loadData();
    } catch (err) {
      console.error("Error guardando movimiento de caja:", err);
    } finally {
      setSavingMov(false);
    }
  };

  // --- Calculations for Tab 3: Comisiones de Técnicos ---
  const desgloseServiciosMecanicos: any[] = [];
  ordenes.forEach((o) => {
    (o.orden_servicio_servicios || []).forEach((s: any) => {
      const mecId = s.mecanico_id || o.mecanico_id;
      const mecObj = mecanicos.find((m) => m.id === mecId);
      if (mecObj) {
        const precioMO = Number(s.precio_cobrado || 0);
        const horas = Number(s.horas_labor || 1);
        const pct = Number(mecObj.comision_porcentaje || 25);
        const comision = precioMO * (pct / 100);

        desgloseServiciosMecanicos.push({
          id: s.id,
          ordenId: o.id,
          folio: o.folio,
          estadoOrden: o.estado,
          estatusPago: o.estatus_pago,
          vehiculo: `${o.vehiculos?.marca || ""} ${o.vehiculos?.modelo || ""} (${
            o.vehiculos?.placas || ""
          })`,
          servicioNombre:
            s.servicios_taller?.nombre || "Servicio de Mano de Obra",
          categoria: s.servicios_taller?.categoria || "General",
          mecanicoId: mecObj.id,
          mecanicoNombre: mecObj.nombre,
          mecanicoColor: mecObj.color_avatar || "#2563EB",
          horas,
          precioMO,
          pct,
          comision,
          fecha: o.fecha_ingreso,
        });
      }
    });
  });

  const resumenMecanicos = mecanicos.map((m) => {
    const items = desgloseServiciosMecanicos.filter(
      (d) => d.mecanicoId === m.id
    );
    const totalHoras = items.reduce((acc, i) => acc + i.horas, 0);
    const totalMO = items.reduce((acc, i) => acc + i.precioMO, 0);
    const totalComision = items.reduce((acc, i) => acc + i.comision, 0);
    return {
      ...m,
      serviciosCount: items.length,
      totalHoras,
      totalMO,
      totalComision,
    };
  });

  const filteredDesgloseMecanicos =
    selectedMecanicoId === "ALL"
      ? desgloseServiciosMecanicos
      : desgloseServiciosMecanicos.filter(
          (d) => d.mecanicoId === selectedMecanicoId
        );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Header & Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs">
        <header className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
              <Landmark size={24} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Caja, Cobranza y Nómina de Técnicos
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white">
                  <Building2 size={11} />
                  {sucursalActiva ? sucursalActiva.nombre : "Todas las Sucursales"}
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 font-medium">
                Control de efectivo en gaveta, cobro directo de órdenes, gastos de caja chica y comisiones por mecánico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === "CajaChica" && (
              <button
                onClick={() => setIsCajaModalOpen(true)}
                className="bg-primary hover:opacity-95 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Plus size={16} /> Registrar Movimiento de Caja
              </button>
            )}
          </div>
        </header>

        <nav className="flex items-center px-6 gap-6 max-w-[1600px] mx-auto w-full overflow-x-auto">
          <button
            onClick={() => setActiveTab("Cobranza")}
            className={`pb-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "Cobranza"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Receipt size={16} />
            1. Cobranza y Corte del Día ({cuentasPorCobrar.length} por cobrar)
          </button>
          <button
            onClick={() => setActiveTab("CajaChica")}
            className={`pb-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "CajaChica"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wallet size={16} />
            2. Caja Chica (Entradas / Salidas)
          </button>
          <button
            onClick={() => setActiveTab("Comisiones")}
            className={`pb-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "Comisiones"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wrench size={16} />
            3. Comisiones de Técnicos (Nómina Operativa)
          </button>
        </nav>
      </div>

      <main className="flex-1 w-full">
        {/* ========================================================= */}
        {/* TAB 1: COBRANZA Y CORTE DEL DÍA                           */}
        {/* ========================================================= */}
        {activeTab === "Cobranza" && (
          <div className="flex flex-col gap-6">
            {/* 5 Financial KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Efectivo en Gaveta
                  </span>
                  <Banknote size={18} className="text-emerald-600" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    $
                    {efectivoEnGaveta.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Fondo/Entradas: ${entradasCajaEfectivo.toLocaleString("es-MX")} • Gastos: -$
                    {salidasCajaEfectivo.toLocaleString("es-MX")}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Transferencias SPEI
                  </span>
                  <Landmark size={18} className="text-blue-600" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    $
                    {cobrosTransferencia.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Sin comisión bancaria (0%)
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Terminal TPV (MP / Stripe)
                  </span>
                  <CreditCard size={18} className="text-indigo-600" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    $
                    {cobrosTPV.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Comisión pasarela: -$
                    {comisionesPasarelaTotal.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                    Total Neto Cobrado
                  </span>
                  <CheckCircle2 size={18} className="text-emerald-600" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-emerald-600 tabular-nums">
                    $
                    {totalNetoCobrado.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Bruto en órdenes: $
                    {totalBrutoCobrado.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                    Cuentas por Cobrar
                  </span>
                  <AlertCircle size={18} className="text-rose-600" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-rose-600 tabular-nums">
                    $
                    {totalPorCobrar.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    En {cuentasPorCobrar.length} órdenes con saldo abierto
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Cuentas por Cobrar Table (7 cols) */}
              <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Cuentas por Cobrar ({cuentasPorCobrar.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cobra directamente en ventanilla o abre el expediente de la orden
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Orden / Vehículo</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Total / Pagado</th>
                        <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {cuentasPorCobrar.map((c) => {
                        const isReady =
                          c.estado === "Listo para Entrega";
                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <Link
                                href={`/tablero?ordenId=${c.id}`}
                                className="font-bold text-slate-900 hover:text-primary"
                              >
                                #{1000 + Number(c.folio || 1)} •{" "}
                                {c.vehiculos?.marca} {c.vehiculos?.modelo}
                              </Link>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {c.vehiculos?.placas} •{" "}
                                {c.vehiculos?.clientes?.nombre}
                              </p>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                  isReady
                                    ? "bg-rose-100 text-rose-700 border border-rose-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {c.estado}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right tabular-nums">
                              <div className="font-bold text-slate-800">
                                $
                                {c.granTotal.toLocaleString("es-MX", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                              <div className="text-xs text-emerald-600 font-semibold">
                                Abonado: $
                                {c.pagado.toLocaleString("es-MX", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right tabular-nums">
                              <span
                                className={`text-base font-bold ${
                                  isReady ? "text-rose-600" : "text-slate-900"
                                }`}
                              >
                                $
                                {c.saldo.toLocaleString("es-MX", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openCobroModal(c)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                                >
                                  Cobrar Ahora
                                </button>
                                <Link
                                  href={`/tablero?ordenId=${c.id}`}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1"
                                >
                                  Ver Orden <ArrowRight size={12} />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {cuentasPorCobrar.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-10 text-center text-slate-400 text-sm"
                          >
                            Excelente: todas las órdenes están liquidadas al 100%.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historial de Pagos Registrados (5 cols) */}
              <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Historial de Pagos Registrados ({pagos.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Incluye auditoría de cancelación con motivo obligatorio
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Orden / Método</th>
                        <th className="py-3 px-4 text-right">Monto / Neto</th>
                        <th className="py-3 px-4 text-right">Auditoría</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {pagos.map((p) => {
                        const isCancelled = Boolean(p.deleted_at);
                        const ord = p.ordenes_servicio;
                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isCancelled ? "opacity-55 bg-rose-50/20" : ""
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/tablero?ordenId=${p.orden_servicio_id}`}
                                  className="font-bold text-slate-900 hover:text-primary"
                                >
                                  #{1000 + Number(ord?.folio || 1)}{" "}
                                  • {ord?.vehiculos?.marca}{" "}
                                  {ord?.vehiculos?.modelo}
                                </Link>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                <span className="font-semibold text-slate-700">
                                  {p.metodo_detalle || p.proveedor_pago}
                                </span>{" "}
                                {p.referencia ? `• Ref: ${p.referencia}` : ""} •{" "}
                                {new Date(p.fecha_pago).toLocaleString("es-MX", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </p>
                              {isCancelled && (
                                <p className="text-[11px] text-rose-600 font-bold mt-1">
                                  Cancelado: {p.motivo_cancelacion}
                                </p>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right tabular-nums">
                              <div
                                className={`font-bold ${
                                  isCancelled
                                    ? "line-through text-slate-400"
                                    : "text-slate-900"
                                }`}
                              >
                                $
                                {Number(p.monto_total).toLocaleString("es-MX", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                              {Number(p.comision_pasarela) > 0 && (
                                <span className="text-[11px] text-slate-400">
                                  Com: -$
                                  {Number(p.comision_pasarela).toLocaleString(
                                    "es-MX",
                                    { minimumFractionDigits: 2 }
                                  )}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              {!isCancelled ? (
                                <button
                                  onClick={() => {
                                    setCancelPago(p);
                                    setMotivoCancelacion("");
                                  }}
                                  className="text-xs font-bold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                                  title="Cancelar pago con registro de auditoría"
                                >
                                  <XCircle size={14} /> Cancelar
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                                  Anulado
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CAJA CHICA (ENTRADAS / SALIDAS)                    */}
        {/* ========================================================= */}
        {activeTab === "CajaChica" && (
          <div className="flex flex-col gap-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Movimientos de Caja Chica y Fondo de Gaveta (
                    {movimientosCaja.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Control de apertura de caja, compra de insumos rápidos, pago a repartidores de refacciones e ingresos extra
                  </p>
                </div>
                <button
                  onClick={() => setIsCajaModalOpen(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus size={15} /> Nuevo Movimiento
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5">Tipo</th>
                      <th className="py-3 px-5">Concepto / Descripción</th>
                      <th className="py-3 px-5">Método</th>
                      <th className="py-3 px-5">Responsable</th>
                      <th className="py-3 px-5">Fecha / Hora</th>
                      <th className="py-3 px-5 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {movimientosCaja.map((m) => {
                      const isInflow =
                        m.tipo === "Fondo Inicial" || m.tipo === "Ingreso Extra";
                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                isInflow
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {isInflow ? (
                                <ArrowDownLeft size={13} />
                              ) : (
                                <ArrowUpRight size={13} />
                              )}
                              {m.tipo}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-semibold text-slate-900">
                            {m.concepto}
                          </td>
                          <td className="py-3.5 px-5 text-slate-600 font-medium">
                            {m.metodo}
                          </td>
                          <td className="py-3.5 px-5 text-slate-600">
                            {m.responsable}
                          </td>
                          <td className="py-3.5 px-5 text-slate-500 text-xs">
                            {new Date(m.created_at).toLocaleString("es-MX", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                          <td
                            className={`py-3.5 px-5 text-right font-bold tabular-nums ${
                              isInflow ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {isInflow ? "+" : "-"}$
                            {Number(m.monto).toLocaleString("es-MX", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: COMISIONES DE TÉCNICOS (NÓMINA OPERATIVA)          */}
        {/* ========================================================= */}
        {activeTab === "Comisiones" && (
          <div className="flex flex-col gap-6">
            {/* Mechanic Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {resumenMecanicos.map((m) => {
                const isSelected = selectedMecanicoId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() =>
                      setSelectedMecanicoId(isSelected ? "ALL" : m.id)
                    }
                    className={`cursor-pointer rounded-xl p-5 border transition-all bg-white shadow-xs ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl text-white font-bold text-base flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: m.color_avatar || "#2563EB",
                          }}
                        >
                          {m.nombre
                            .split(" ")
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">
                            {m.nombre}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">
                            {m.puesto || "Técnico"} • {m.especialidad}
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                        {Number(m.comision_porcentaje || 25)}% Com.
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Horas MO
                        </p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">
                          {m.totalHoras.toFixed(1)} hrs
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          MO Generada
                        </p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5 tabular-nums">
                          $
                          {m.totalMO.toLocaleString("es-MX", {
                            maximumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-emerald-700">
                          A Pagar
                        </p>
                        <p className="text-base font-bold text-emerald-600 mt-0.5 tabular-nums">
                          $
                          {m.totalComision.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Service Breakdown Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Desglose de Servicios y Mano de Obra por Técnico (
                    {filteredDesgloseMecanicos.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Haz clic en una tarjeta superior para filtrar por mecánico o{" "}
                    <button
                      onClick={() => setSelectedMecanicoId("ALL")}
                      className="text-primary font-bold hover:underline"
                    >
                      ver todos los técnicos
                    </button>
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5">Técnico</th>
                      <th className="py-3 px-5">Orden / Vehículo</th>
                      <th className="py-3 px-5">Servicio Realizado</th>
                      <th className="py-3 px-5 text-center">Horas</th>
                      <th className="py-3 px-5 text-right">Mano de Obra</th>
                      <th className="py-3 px-5 text-right">% / Comisión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredDesgloseMecanicos.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: item.mecanicoColor }}
                            />
                            {item.mecanicoNombre}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <Link
                            href={`/tablero?ordenId=${item.ordenId}`}
                            className="font-bold text-primary hover:underline font-mono"
                          >
                            #{1000 + Number(item.folio || 1)}
                          </Link>
                          <span className="text-xs text-slate-600 ml-1.5">
                            {item.vehiculo}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <p className="font-semibold text-slate-900">
                            {item.servicioNombre}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.categoria} • Orden: {item.estadoOrden}
                          </p>
                        </td>
                        <td className="py-3.5 px-5 text-center font-bold text-slate-700">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-xs">
                            <Clock size={11} /> {item.horas} hrs
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-slate-900 tabular-nums">
                          $
                          {item.precioMO.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3.5 px-5 text-right tabular-nums">
                          <span className="text-xs text-slate-400 mr-1.5">
                            ({item.pct}%)
                          </span>
                          <span className="font-bold text-emerald-600">
                            $
                            {item.comision.toLocaleString("es-MX", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL: COBRAR AHORA (INLINE PAYMENT)                      */}
      {/* ========================================================= */}
      {cobroOrden && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Registrar Cobro • OS-{cobroOrden.folio}
                </h3>
                <p className="text-xs text-slate-500">
                  {cobroOrden.vehiculos?.marca} {cobroOrden.vehiculos?.modelo} (
                  {cobroOrden.vehiculos?.placas})
                </p>
              </div>
              <button
                onClick={() => setCobroOrden(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleConfirmarCobro}
              className="p-6 flex flex-col gap-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Monto a Cobrar (Saldo: $
                  {cobroOrden.saldo.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                  })}
                  )
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={cobroMonto}
                  onChange={(e) => setCobroMonto(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-lg font-bold text-slate-900 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                  Método / Pasarela de Pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      "Efectivo",
                      "Transferencia",
                      "Mercado Pago",
                      "Stripe",
                    ] as const
                  ).map((prov) => (
                    <button
                      type="button"
                      key={prov}
                      onClick={() => handleProveedorSelect(prov)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border text-left transition-all ${
                        cobroProveedor === prov
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Detalle Método
                  </label>
                  <input
                    type="text"
                    value={cobroDetalle}
                    onChange={(e) => setCobroDetalle(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Referencia / Folio Voucher
                  </label>
                  <input
                    type="text"
                    value={cobroReferencia}
                    onChange={(e) => setCobroReferencia(e.target.value)}
                    placeholder="Ej. SPEI-9821"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCobroOrden(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCobro}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  {savingCobro ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CANCELAR PAGO (AUDITED SOFT-DELETE)                */}
      {/* ========================================================= */}
      {cancelPago && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-rose-50">
              <h3 className="text-base font-bold text-rose-900">
                Anular Pago Registrado (Auditoría)
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                Monto: ${Number(cancelPago.monto_total).toLocaleString("es-MX")}{" "}
                • {cancelPago.metodo_detalle || cancelPago.proveedor_pago}
              </p>
            </div>
            <form
              onSubmit={handleConfirmarCancelacion}
              className="p-6 flex flex-col gap-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Motivo de Cancelación (Obligatorio)
                </label>
                <textarea
                  required
                  rows={3}
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                  placeholder="Ej. Error en captura de monto o devolución en terminal..."
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelPago(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={savingCancel}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold"
                >
                  {savingCancel ? "Anulando..." : "Confirmar Anulación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: REGISTRAR MOVIMIENTO DE CAJA CHICA                 */}
      {/* ========================================================= */}
      {isCajaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">
                Registrar Movimiento de Caja Chica
              </h3>
              <button
                onClick={() => setIsCajaModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSaveMovimiento}
              className="p-6 flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Tipo de Movimiento
                  </label>
                  <select
                    value={movForm.tipo}
                    onChange={(e) =>
                      setMovForm({ ...movForm, tipo: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold"
                  >
                    <option value="Fondo Inicial">Fondo Inicial (+)</option>
                    <option value="Ingreso Extra">Ingreso Extra (+)</option>
                    <option value="Gasto / Insumos">Gasto / Insumos (-)</option>
                    <option value="Pago Proveedor">Pago Proveedor (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Monto ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={movForm.monto}
                    onChange={(e) =>
                      setMovForm({ ...movForm, monto: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Concepto / Justificación
                </label>
                <input
                  type="text"
                  required
                  value={movForm.concepto}
                  onChange={(e) =>
                    setMovForm({ ...movForm, concepto: e.target.value })
                  }
                  placeholder="Ej. Compra de limpiador de frenos y trapos industriales"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Método
                  </label>
                  <select
                    value={movForm.metodo}
                    onChange={(e) =>
                      setMovForm({ ...movForm, metodo: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Responsable
                  </label>
                  <input
                    type="text"
                    value={movForm.responsable}
                    onChange={(e) =>
                      setMovForm({ ...movForm, responsable: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCajaModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMov}
                  className="bg-primary hover:opacity-95 text-white px-5 py-2.5 rounded-xl text-xs font-bold"
                >
                  {savingMov ? "Guardando..." : "Guardar Movimiento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
