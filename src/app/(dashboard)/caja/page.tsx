"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/context/TenantContext";
import Link from "next/link";
import QRCode from "qrcode";
import { ReceiptModal } from "@/components/caja/ReceiptModal";
import { simularCuotasBNPL, CuotaSimulation } from "@/app/actions/payments";
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
  Search,
  QrCode,
  Smartphone,
  Copy,
  Check,
  Printer,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Coins,
} from "lucide-react";

type TabType = "POS" | "Cobranza" | "CajaChica" | "Comisiones";

const QUICK_CASH_AMOUNTS = [100, 200, 500, 1000];

export default function CajaPage() {
  const supabase = createClient();
  const { empresa, sucursalActiva, sucursales } = useTenant();

  const [activeTab, setActiveTab] = useState<TabType>("POS");
  const [loading, setLoading] = useState(true);

  // Data States
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [movimientosCaja, setMovimientosCaja] = useState<any[]>([]);
  const [mecanicos, setMecanicos] = useState<any[]>([]);
  const [configPagos, setConfigPagos] = useState<any[]>([]);

  // POS State
  const [posSelectedOrderId, setPosSelectedOrderId] = useState<string | null>(null);
  const [posSearchQuery, setPosSearchQuery] = useState("");
  const [posStatusFilter, setPosStatusFilter] = useState<"ALL" | "READY" | "PARTIAL">("ALL");

  // Active Payment Form in POS
  const [selectedMethod, setSelectedMethod] = useState<
    "Efectivo" | "TPV" | "SPEI" | "KueskiPay" | "Atrato" | "Stripe"
  >("Efectivo");

  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [cashGiven, setCashGiven] = useState<string>("");
  const [tpvType, setTpvType] = useState<string>("Terminal Point Smart (Mercado Pago)");
  const [tpvReference, setTpvReference] = useState<string>("");
  const [speiRastreo, setSpeiRastreo] = useState<string>("");
  const [copiedClabe, setCopiedClabe] = useState(false);

  // BNPL & Online Links
  const [bnplProvider, setBnplProvider] = useState<"KueskiPay" | "Atrato">("KueskiPay");
  const [bnplCuotas, setBnplCuotas] = useState<CuotaSimulation[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [bnplReference, setBnplReference] = useState<string>("");

  // Saving Payment State
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Thermal Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<any | null>(null);
  const [receiptCashGiven, setReceiptCashGiven] = useState<number | undefined>(undefined);
  const [receiptChangeDue, setReceiptChangeDue] = useState<number | undefined>(undefined);

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

  // Selected mechanic filter in Tab 4
  const [selectedMecanicoId, setSelectedMecanicoId] = useState<string>("ALL");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam === "POS" ||
        tabParam === "Cobranza" ||
        tabParam === "CajaChica" ||
        tabParam === "Comisiones"
      ) {
        setActiveTab(tabParam as TabType);
      }
      const orderParam = params.get("ordenId");
      if (orderParam) {
        setPosSelectedOrderId(orderParam);
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
          sub_estado,
          estatus_pago,
          mecanico_id,
          fecha_ingreso,
          bahia_rampa,
          problema_reportado,
          vehiculos ( id, marca, modelo, anio, placas, kilometraje_actual, clientes ( id, nombre, telefono, correo, rfc ) ),
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
            nombre,
            cantidad,
            precio_unitario,
            subtotal,
            estatus_aprobacion
          ),
          cotizaciones (
            detalles_cotizacion ( subtotal, estatus_aprobacion, llanta:inventario_llantas(marca, modelo_llanta, ancho, perfil, rin) )
          ),
          pagos_orden (
            id,
            monto_total,
            estatus,
            deleted_at,
            proveedor_pago,
            metodo_detalle,
            referencia,
            fecha_pago
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

        // Pre-select first pending order if none selected
        if (!posSelectedOrderId) {
          const firstPending = enriched.find((o) => o.saldo > 0.01);
          if (firstPending) {
            setPosSelectedOrderId(firstPending.id);
            setPaymentAmount(firstPending.saldo.toFixed(2));
          }
        }
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
  }, [sucursalActiva, posSelectedOrderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Active Selected Order in POS
  const activeOrder = useMemo(() => {
    return ordenes.find((o) => o.id === posSelectedOrderId) || null;
  }, [ordenes, posSelectedOrderId]);

  // Update default payment amount whenever active order changes
  useEffect(() => {
    if (activeOrder) {
      setPaymentAmount(activeOrder.saldo > 0 ? activeOrder.saldo.toFixed(2) : "0.00");
      setCashGiven("");
      setTpvReference("");
      setSpeiRastreo("");
      setQrCodeUrl(null);
    }
  }, [activeOrder]);

  // Load BNPL Simulation whenever method or provider changes
  useEffect(() => {
    if (selectedMethod === "KueskiPay" || selectedMethod === "Atrato") {
      const targetProvider = selectedMethod === "KueskiPay" ? "KueskiPay" : "Atrato";
      setBnplProvider(targetProvider);
      const amountNum = parseFloat(paymentAmount) || activeOrder?.saldo || 0;
      simularCuotasBNPL(amountNum, targetProvider).then((sims) => {
        setBnplCuotas(sims);
      });
    }
  }, [selectedMethod, paymentAmount, activeOrder]);

  // Filtered Orders for POS list
  const filteredPosOrders = useMemo(() => {
    return ordenes.filter((o) => {
      // Must have balance due for POS unless searching
      if (o.saldo <= 0.01 && !posSearchQuery.trim()) return false;

      if (posStatusFilter === "READY" && o.estado !== "Listo para Entrega") return false;
      if (posStatusFilter === "PARTIAL" && (o.pagado <= 0.01 || o.saldo <= 0.01)) return false;

      if (!posSearchQuery.trim()) return true;
      const q = posSearchQuery.toLowerCase();
      const folioStr = `#${1000 + Number(o.folio || 1)}`.toLowerCase();
      const vehStr = `${o.vehiculos?.marca || ""} ${o.vehiculos?.modelo || ""} ${o.vehiculos?.placas || ""}`.toLowerCase();
      const cliStr = `${o.vehiculos?.clientes?.nombre || ""}`.toLowerCase();
      return folioStr.includes(q) || vehStr.includes(q) || cliStr.includes(q);
    });
  }, [ordenes, posSearchQuery, posStatusFilter]);

  // Cash Calculation
  const amountToPay = parseFloat(paymentAmount) || 0;
  const cashGivenNum = parseFloat(cashGiven) || 0;
  const changeDue = Math.max(0, cashGivenNum - amountToPay);
  const cashShortage = Math.max(0, amountToPay - cashGivenNum);

  // Financial KPIs for Tab 2
  const pagosActivos = pagos.filter((p) => p.estatus === "Aprobado" && !p.deleted_at);

  const cobrosEfectivo = pagosActivos
    .filter((p) => p.proveedor_pago === "Efectivo")
    .reduce((acc, p) => acc + Number(p.monto_total || 0), 0);

  const cobrosTransferencia = pagosActivos
    .filter((p) => p.proveedor_pago === "Transferencia")
    .reduce((acc, p) => acc + Number(p.monto_total || 0), 0);

  const cobrosTPV = pagosActivos
    .filter((p) => p.proveedor_pago === "Mercado Pago" || p.proveedor_pago === "Stripe")
    .reduce((acc, p) => acc + Number(p.monto_total || 0), 0);

  const cobrosBNPL = pagosActivos
    .filter((p) => p.proveedor_pago === "KueskiPay" || p.proveedor_pago === "Atrato")
    .reduce((acc, p) => acc + Number(p.monto_total || 0), 0);

  const comisionesPasarelaTotal = pagosActivos.reduce(
    (acc, p) => acc + Number(p.comision_pasarela || 0),
    0
  );

  const totalBrutoCobrado = cobrosEfectivo + cobrosTransferencia + cobrosTPV + cobrosBNPL;
  const totalNetoCobrado = totalBrutoCobrado - comisionesPasarelaTotal;

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

  const efectivoEnGaveta = entradasCajaEfectivo + cobrosEfectivo - salidasCajaEfectivo;

  const cuentasPorCobrar = ordenes.filter((o) => o.saldo > 0.01);
  const totalPorCobrar = cuentasPorCobrar.reduce((acc, o) => acc + o.saldo, 0);

  // Generate QR for BNPL or Online Link
  const handleGenerateQR = async (provider: "KueskiPay" | "Atrato" | "Stripe" | "Mercado Pago") => {
    if (!activeOrder) return;
    setGeneratingQr(true);
    try {
      const amount = parseFloat(paymentAmount) || activeOrder.saldo;
      const ref = `${provider.toLowerCase().replace(/\s+/g, "")}_${Date.now()}`;
      setBnplReference(ref);

      let checkoutUrl = "";
      if (provider === "KueskiPay") {
        checkoutUrl = `https://pay.kueskipay.com/checkout/${ref}?order=${activeOrder.id}&amount=${amount}`;
      } else if (provider === "Atrato") {
        checkoutUrl = `https://checkout.atratopago.com/solicitud/${ref}?order=${activeOrder.id}&amount=${amount}`;
      } else if (provider === "Stripe") {
        checkoutUrl = `https://checkout.stripe.com/pay/${ref}#order=${activeOrder.id}&amount=${amount}`;
      } else {
        checkoutUrl = `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${ref}&amount=${amount}`;
      }

      const qr = await QRCode.toDataURL(checkoutUrl, {
        width: 320,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrCodeUrl(qr);
    } catch (err) {
      console.error("Error generating QR:", err);
    } finally {
      setGeneratingQr(false);
    }
  };

  // Confirm and Execute POS Payment
  const handleExecutePayment = async () => {
    if (!activeOrder) return;
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setIsProcessingPayment(true);
    try {
      let dbProvider: "Efectivo" | "Transferencia" | "Mercado Pago" | "Stripe" | "KueskiPay" | "Atrato" = "Efectivo";
      let detalle = "Efectivo en Ventanilla";
      let ref = `AUT-${Math.floor(100000 + Math.random() * 900000)}`;

      if (selectedMethod === "Efectivo") {
        dbProvider = "Efectivo";
        detalle = `Efectivo (Entregó: $${cashGivenNum.toLocaleString("es-MX")} • Cambio: $${changeDue.toLocaleString("es-MX")})`;
      } else if (selectedMethod === "TPV") {
        dbProvider = "Mercado Pago";
        detalle = tpvType;
        ref = tpvReference.trim() || `TPV-${Math.floor(100000 + Math.random() * 900000)}`;
      } else if (selectedMethod === "SPEI") {
        dbProvider = "Transferencia";
        detalle = "Transferencia Bancaria SPEI (BBVA)";
        ref = speiRastreo.trim() || `SPEI-${Date.now().toString().slice(-8)}`;
      } else if (selectedMethod === "KueskiPay") {
        dbProvider = "KueskiPay";
        detalle = "Kueski Pay (Compre Ahora, Pague Después)";
        ref = bnplReference || `KUESKI-${Date.now().toString().slice(-8)}`;
      } else if (selectedMethod === "Atrato") {
        dbProvider = "Atrato";
        detalle = "Atrato Pago (Financiamiento Automotriz)";
        ref = bnplReference || `ATRATO-${Date.now().toString().slice(-8)}`;
      } else if (selectedMethod === "Stripe") {
        dbProvider = "Stripe";
        detalle = "Stripe Checkout (Tarjeta / MSI)";
        ref = bnplReference || `STRIPE-${Date.now().toString().slice(-8)}`;
      }

      const cfg = configPagos.find((c) => c.proveedor === dbProvider);
      const pctComision = Number(cfg?.comision_porcentaje || 0);
      const comisionMonto = Number(((amountNum * pctComision) / 100).toFixed(2));

      const targetSucursalId =
        activeOrder.sucursal_id ||
        sucursalActiva?.id ||
        sucursales[0]?.id ||
        "b0000000-0000-0000-0000-000000000001";

      const { data: newPago, error: pagoErr } = await supabase
        .from("pagos_orden")
        .insert({
          orden_servicio_id: activeOrder.id,
          sucursal_id: targetSucursalId,
          monto_total: amountNum,
          proveedor_pago: dbProvider,
          metodo_detalle: detalle,
          referencia: ref,
          estatus: "Aprobado",
          comision_pasarela: comisionMonto,
          fecha_pago: new Date().toISOString(),
        })
        .select()
        .single();

      if (pagoErr) throw pagoErr;

      const nuevoPagado = activeOrder.pagado + amountNum;
      const nuevoEstatus =
        nuevoPagado >= activeOrder.granTotal - 0.5 ? "Pagado" : "Parcial";

      await supabase
        .from("ordenes_servicio")
        .update({ estatus_pago: nuevoEstatus })
        .eq("id", activeOrder.id);

      // Open Thermal Receipt Modal
      setReceiptOrder({
        ...activeOrder,
        pagado: nuevoPagado,
        saldo: Math.max(0, activeOrder.granTotal - nuevoPagado),
      });
      setReceiptPayment(newPago);
      setReceiptCashGiven(selectedMethod === "Efectivo" ? cashGivenNum : undefined);
      setReceiptChangeDue(selectedMethod === "Efectivo" ? changeDue : undefined);
      setReceiptModalOpen(true);

      await loadData();
    } catch (err) {
      console.error("Error ejecutando cobro:", err);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handler: Cancelar Pago (Soft Delete)
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

  // Handler: Registrar Movimiento Caja Chica
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

  // Tab 4: Comisiones de Técnicos
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
    const items = desgloseServiciosMecanicos.filter((d) => d.mecanicoId === m.id);
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

  const copyClabeToClipboard = () => {
    navigator.clipboard.writeText("012180015482910248");
    setCopiedClabe(true);
    setTimeout(() => setCopiedClabe(false), 2000);
  };

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
              <Receipt size={24} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Punto de Venta (POS) y Caja de Ventanilla
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white">
                  <Building2 size={11} />
                  {sucursalActiva ? sucursalActiva.nombre : "Todas las Sucursales"}
                </span>
                {cuentasPorCobrar.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                    {cuentasPorCobrar.length} pendientes por liquidar
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm text-slate-500 font-medium">
                Terminal de cobro en mostrador, financiamiento BNPL (Kueski / Atrato), terminales TPV y tickets térmicos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
              <span className="px-2.5 py-1 text-slate-500">Por Cobrar en Taller:</span>
              <span className="px-2.5 py-1 bg-white text-rose-600 rounded-lg shadow-xs font-black tabular-nums">
                ${totalPorCobrar.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </header>

        <nav className="flex items-center px-5 gap-6 w-full overflow-x-auto border-t border-slate-100">
          <button
            onClick={() => setActiveTab("POS")}
            className={`py-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "POS"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Smartphone size={16} />
            1. Terminal de Cobro Rápido (POS)
          </button>
          <button
            onClick={() => setActiveTab("Cobranza")}
            className={`py-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "Cobranza"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Landmark size={16} />
            2. Corte del Día y Auditoría ({cuentasPorCobrar.length} abiertas)
          </button>
          <button
            onClick={() => setActiveTab("CajaChica")}
            className={`py-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "CajaChica"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wallet size={16} />
            3. Caja Chica (Entradas / Salidas)
          </button>
          <button
            onClick={() => setActiveTab("Comisiones")}
            className={`py-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "Comisiones"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wrench size={16} />
            4. Nómina de Comisiones por Técnico
          </button>
        </nav>
      </div>

      <main className="flex-1 w-full">
        {/* ========================================================= */}
        {/* TAB 1: TERMINAL DE COBRO RÁPIDO (POS VENTANILLA)         */}
        {/* ========================================================= */}
        {activeTab === "POS" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Col (5 cols): Order Selector & Search */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt size={14} className="text-primary" />
                    Órdenes con Saldo ({filteredPosOrders.length})
                  </h2>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Haz clic para cargar en la terminal
                  </span>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={posSearchQuery}
                    onChange={(e) => setPosSearchQuery(e.target.value)}
                    placeholder="Buscar por folio, placa (SPG-902-A), cliente..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-slate-50/50"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setPosStatusFilter("ALL")}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      posStatusFilter === "ALL"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Todas ({cuentasPorCobrar.length})
                  </button>
                  <button
                    onClick={() => setPosStatusFilter("READY")}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      posStatusFilter === "READY"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Listos ({ordenes.filter((o) => o.estado === "Listo para Entrega" && o.saldo > 0).length})
                  </button>
                  <button
                    onClick={() => setPosStatusFilter("PARTIAL")}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      posStatusFilter === "PARTIAL"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Parciales ({ordenes.filter((o) => o.pagado > 0.01 && o.saldo > 0.01).length})
                  </button>
                </div>
              </div>

              {/* Order Cards List */}
              <div className="flex flex-col gap-2 max-h-[700px] overflow-y-auto pr-1">
                {filteredPosOrders.map((ord) => {
                  const isSelected = ord.id === posSelectedOrderId;
                  const isReady = ord.estado === "Listo para Entrega";
                  const veh = ord.vehiculos || {};
                  const cli = veh.clientes || {};
                  const folio = `#${1000 + Number(ord.folio || 1)}`;

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setPosSelectedOrderId(ord.id)}
                      className={`cursor-pointer rounded-xl p-3.5 border transition-all flex flex-col gap-2 ${
                        isSelected
                          ? "bg-white border-primary ring-2 ring-primary/20 shadow-md"
                          : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {folio}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isReady
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {ord.estado}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 mt-0.5">
                            {veh.marca} {veh.modelo} ({veh.placas || "Sin placas"})
                          </p>
                          <p className="text-[11px] text-slate-500">{cli.nombre || "Venta General"}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-rose-600 tabular-nums">
                            ${ord.saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Total: ${ord.granTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-1.5 mt-0.5">
                        <span>Rampa: {ord.bahia_rampa || "General"}</span>
                        <span className="text-primary font-bold inline-flex items-center gap-0.5">
                          {isSelected ? "Seleccionada en POS" : "Cargar en Terminal →"}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {filteredPosOrders.length === 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
                    No se encontraron órdenes con saldo pendiente.
                  </div>
                )}
              </div>
            </div>

            {/* Right Col (7 cols): Active POS Terminal */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {activeOrder ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
                  {/* Top Bar of Active Order */}
                  <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-white">
                          #{1000 + Number(activeOrder.folio || 1)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">
                          {activeOrder.estado}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold">
                          Debe: ${activeOrder.saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {activeOrder.vehiculos?.marca} {activeOrder.vehiculos?.modelo} (
                        {activeOrder.vehiculos?.placas || "Sin placas"}) •{" "}
                        <span className="font-semibold text-white">
                          {activeOrder.vehiculos?.clientes?.nombre}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/tablero?ordenId=${activeOrder.id}`}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-colors inline-flex items-center gap-1"
                      >
                        Ver Orden <ExternalLink size={12} />
                      </Link>
                    </div>
                  </div>

                  {/* Summary of Items */}
                  <div className="p-4 bg-slate-50/70 border-b border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-bold">Mano de Obra</span>
                      <span className="font-bold text-slate-900">
                        ${Number(activeOrder.srvTotal || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-bold">Refacciones</span>
                      <span className="font-bold text-slate-900">
                        ${Number(activeOrder.refTotal || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-bold">Llantas</span>
                      <span className="font-bold text-slate-900">
                        ${Number(activeOrder.llantasTotal || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-bold">Abonado Previo</span>
                      <span className="font-bold text-emerald-600">
                        ${Number(activeOrder.pagado || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Amount to Collect Input */}
                  <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Monto a Cobrar en esta Transacción:
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Puedes liquidar el saldo total o registrar un anticipo parcial
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-base">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="pl-7 pr-3 py-2 text-lg font-bold text-slate-900 border border-slate-300 rounded-xl w-44 text-right focus:outline-none focus:border-primary"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(activeOrder.saldo.toFixed(2))}
                        className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        Saldo Total
                      </button>
                    </div>
                  </div>

                  {/* Payment Method Selector Grid */}
                  <div className="p-5 flex flex-col gap-4">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Selecciona Método de Pago o Pasarela:
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {/* 1. Efectivo */}
                      <button
                        type="button"
                        onClick={() => setSelectedMethod("Efectivo")}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          selectedMethod === "Efectivo"
                            ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Banknote size={18} className="text-emerald-600" />
                          <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Sin comisión
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 mt-1">Efectivo en Gaveta</span>
                        <span className="text-[10px] text-slate-500">Con calculadora de cambio</span>
                      </button>

                      {/* 2. TPV Bancaria / Point */}
                      <button
                        type="button"
                        onClick={() => setSelectedMethod("TPV")}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          selectedMethod === "TPV"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <CreditCard size={18} className="text-primary" />
                          <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            TPV Física
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 mt-1">Terminal TPV Point</span>
                        <span className="text-[10px] text-slate-500">Tarjeta Débito / Crédito</span>
                      </button>

                      {/* 3. SPEI Bancario */}
                      <button
                        type="button"
                        onClick={() => setSelectedMethod("SPEI")}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          selectedMethod === "SPEI"
                            ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Landmark size={18} className="text-blue-600" />
                          <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                            SPEI
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 mt-1">Transferencia SPEI</span>
                        <span className="text-[10px] text-slate-500">CLABE BBVA en pantalla</span>
                      </button>

                      {/* 4. Kueski Pay (BNPL) */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMethod("KueskiPay");
                          handleGenerateQR("KueskiPay");
                        }}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          selectedMethod === "KueskiPay"
                            ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Coins size={18} className="text-indigo-600" />
                          <span className="text-[10px] font-bold uppercase text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                            BNPL Quincenas
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 mt-1">Kueski Pay (BNPL)</span>
                        <span className="text-[10px] text-slate-500">Sin tarjeta requerida</span>
                      </button>

                      {/* 5. Atrato Pago (BNPL Automotriz) */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMethod("Atrato");
                          handleGenerateQR("Atrato");
                        }}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          selectedMethod === "Atrato"
                            ? "border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Sparkles size={18} className="text-purple-600" />
                          <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                            Crédito Llantas
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 mt-1">Atrato Pago</span>
                        <span className="text-[10px] text-slate-500">Hasta 24 meses automotriz</span>
                      </button>

                      {/* 6. Stripe Checkout */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMethod("Stripe");
                          handleGenerateQR("Stripe");
                        }}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          selectedMethod === "Stripe"
                            ? "border-sky-600 bg-sky-50/50 ring-2 ring-sky-600/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <CreditCard size={18} className="text-sky-600" />
                          <span className="text-[10px] font-bold uppercase text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                            Enlace / MSI
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 mt-1">Stripe Checkout</span>
                        <span className="text-[10px] text-slate-500">Pago en línea con tarjeta</span>
                      </button>
                    </div>

                    {/* METHOD DETAILS CONTAINER */}
                    <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 mt-2">
                      {/* 1. EFECTIVO EN VENTANILLA */}
                      {selectedMethod === "Efectivo" && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              Calculadora de Cambio (Efectivo):
                            </span>
                            <span className="text-xs text-slate-500">
                              Total a cobrar:{" "}
                              <strong className="text-slate-900">${amountToPay.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>
                            </span>
                          </div>

                          {/* Quick cash pills */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-slate-400">Billetes comunes:</span>
                            {QUICK_CASH_AMOUNTS.map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setCashGiven(String(amt))}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold hover:bg-slate-100 text-slate-700 transition-colors"
                              >
                                +${amt}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setCashGiven(String(amountToPay))}
                              className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                            >
                              Pago Exacto
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                Efectivo recibido del cliente:
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                                  $
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={cashGiven}
                                  onChange={(e) => setCashGiven(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full pl-7 pr-3 py-2 text-base font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-600"
                                />
                              </div>
                            </div>

                            {/* Change Due Indicator */}
                            <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                  Cambio a Devolver
                                </span>
                                <span
                                  className={`text-xl font-black tabular-nums ${
                                    cashShortage > 0.01 ? "text-amber-600" : "text-emerald-600"
                                  }`}
                                >
                                  ${changeDue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              {cashShortage > 0.01 && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                  Faltan ${cashShortage.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. TPV BANCARIA */}
                      {selectedMethod === "TPV" && (
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                Terminal / Pasarela:
                              </label>
                              <select
                                value={tpvType}
                                onChange={(e) => setTpvType(e.target.value)}
                                className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                              >
                                <option value="Terminal Point Smart (Mercado Pago)">
                                  Terminal Point Smart (Mercado Pago TPV)
                                </option>
                                <option value="Terminal Bancaria BBVA / Banorte">
                                  Terminal Bancaria BBVA / Banorte
                                </option>
                                <option value="Tarjeta de Débito">Tarjeta de Débito (Ventanilla)</option>
                                <option value="Tarjeta de Crédito">Tarjeta de Crédito (Ventanilla)</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                Folio de Autorización / Voucher:
                              </label>
                              <input
                                type="text"
                                value={tpvReference}
                                onChange={(e) => setTpvReference(e.target.value)}
                                placeholder="Ej: AUT-894120 o últimos 4 dígitos"
                                className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3. SPEI BANCARIO */}
                      {selectedMethod === "SPEI" && (
                        <div className="flex flex-col gap-3">
                          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs">
                              <p className="font-bold text-blue-950">Datos para Transferencia SPEI:</p>
                              <p className="text-blue-900 mt-0.5">
                                Banco: <strong>BBVA México</strong> • Beneficiario:{" "}
                                <strong>Torque & Ruta S.A. de C.V.</strong>
                              </p>
                              <p className="font-mono text-xs font-bold text-blue-950 mt-1">
                                CLABE: 012 180 01548291024 8
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={copyClabeToClipboard}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto transition-colors"
                            >
                              {copiedClabe ? <Check size={14} /> : <Copy size={14} />}
                              {copiedClabe ? "¡CLABE Copiada!" : "Copiar CLABE"}
                            </button>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Clave de Rastreo SPEI / Comprobante:
                            </label>
                            <input
                              type="text"
                              value={speiRastreo}
                              onChange={(e) => setSpeiRastreo(e.target.value)}
                              placeholder="Ej: BNET0100234891 o Folio Banxico"
                              className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* 4 & 5. BNPL (KUESKI / ATRATO) & 6. STRIPE */}
                      {(selectedMethod === "KueskiPay" ||
                        selectedMethod === "Atrato" ||
                        selectedMethod === "Stripe") && (
                        <div className="flex flex-col gap-3">
                          {/* BNPL Simulation Table */}
                          {bnplCuotas.length > 0 && selectedMethod !== "Stripe" && (
                            <div>
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                Planes de Financiamiento Disponibles para el Cliente:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {bnplCuotas.map((c, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white border border-slate-200 rounded-lg p-2.5 text-center flex flex-col justify-between"
                                  >
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                      {c.plazo}
                                    </span>
                                    <span className="text-base font-bold text-slate-900 mt-1 tabular-nums">
                                      ${c.monto_cuota.toLocaleString("es-MX")}
                                      <span className="text-[10px] font-normal text-slate-500">
                                        /{selectedMethod === "KueskiPay" ? "quincena" : "mes"}
                                      </span>
                                    </span>
                                    <p className="text-[9px] text-slate-500 mt-1">{c.leyenda}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* QR Generator Box */}
                          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white border border-slate-200 rounded-xl p-3.5">
                            {qrCodeUrl ? (
                              <div className="shrink-0 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                <img src={qrCodeUrl} alt="QR Code" className="w-28 h-28 object-contain" />
                              </div>
                            ) : (
                              <div className="w-28 h-28 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 text-slate-400">
                                {generatingQr ? (
                                  <Loader2 size={24} className="animate-spin" />
                                ) : (
                                  <QrCode size={36} />
                                )}
                              </div>
                            )}

                            <div className="flex flex-col gap-1.5 text-xs flex-1">
                              <h4 className="font-bold text-slate-900">
                                {selectedMethod === "KueskiPay"
                                  ? "Kueski Pay: Compre Ahora, Pague Después"
                                  : selectedMethod === "Atrato"
                                  ? "Atrato Pago: Crédito en Mostrador"
                                  : "Stripe Checkout: Enlace Directo"}
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Pídele al cliente que apunte su cámara al código QR para completar la solicitud en su celular, o envíaselo directamente por WhatsApp.
                              </p>

                              <div className="flex items-center gap-2 mt-1">
                                {!qrCodeUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateQR(selectedMethod as any)}
                                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5"
                                  >
                                    <QrCode size={13} /> Generar Código QR
                                  </button>
                                ) : (
                                  activeOrder.vehiculos?.clientes?.telefono && (
                                    <a
                                      href={`https://wa.me/52${activeOrder.vehiculos.clientes.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(
                                        `Hola ${activeOrder.vehiculos.clientes.nombre}, aquí tienes tu link de financiamiento para la Orden #${1000 + Number(activeOrder.folio || 1)} por $${amountToPay.toLocaleString("es-MX")}: ${
                                          selectedMethod === "KueskiPay"
                                            ? "https://pay.kueskipay.com"
                                            : selectedMethod === "Atrato"
                                            ? "https://checkout.atratopago.com"
                                            : "https://checkout.stripe.com"
                                        }`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5"
                                    >
                                      <MessageCircle size={13} /> Enviar QR por WhatsApp
                                    </a>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SUBMIT BUTTON */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleExecutePayment}
                        disabled={isProcessingPayment || (selectedMethod === "Efectivo" && cashShortage > 0.01)}
                        className="w-full py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-black text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isProcessingPayment ? (
                          <>
                            <Loader2 size={18} className="animate-spin" /> Procesando Cobro...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={18} />
                            REGISTRAR COBRO (${amountToPay.toLocaleString("es-MX", { minimumFractionDigits: 2 })}) Y EMITIR TICKET
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <Receipt size={40} className="text-slate-300" />
                  <p className="font-bold text-sm text-slate-700">Ninguna orden seleccionada en la Terminal</p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Selecciona una orden de la lista izquierda para ingresar montos, calcular cambio en efectivo o generar links BNPL.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CORTE DEL DÍA Y AUDITORÍA                          */}
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
                    Fondo: ${entradasCajaEfectivo.toLocaleString("es-MX")} • Gastos: -$
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
                    Terminal TPV / Tarjetas
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
                    Comisión: -${comisionesPasarelaTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-purple-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                    BNPL (Kueski / Atrato)
                  </span>
                  <Coins size={18} className="text-purple-600" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-purple-600 tabular-nums">
                    $
                    {cobrosBNPL.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Financiamiento en quincenas/meses
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
                    En {cuentasPorCobrar.length} órdenes abiertas
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Cuentas por Cobrar Table */}
              <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Cuentas por Cobrar ({cuentasPorCobrar.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Orden / Vehículo</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {cuentasPorCobrar.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">
                              #{1000 + Number(c.folio || 1)} • {c.vehiculos?.marca} {c.vehiculos?.modelo}
                            </span>
                            <span className="text-xs text-slate-500">
                              {c.vehiculos?.placas} • {c.vehiculos?.clientes?.nombre}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {c.estado}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-600 tabular-nums">
                            ${c.saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setPosSelectedOrderId(c.id);
                                setActiveTab("POS");
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
                            >
                              Cargar en POS
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historial de Pagos con Auditoría */}
              <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Historial de Pagos Registrados ({pagos.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Orden / Método</th>
                        <th className="py-2.5 px-3 text-right">Monto</th>
                        <th className="py-2.5 px-3 text-right">Auditoría</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagos.map((p) => {
                        const isCancelled = Boolean(p.deleted_at);
                        const ord = p.ordenes_servicio;
                        return (
                          <tr key={p.id} className={isCancelled ? "opacity-50 bg-rose-50/20" : ""}>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">
                                #{1000 + Number(ord?.folio || 1)} • {ord?.vehiculos?.marca}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {p.metodo_detalle || p.proveedor_pago}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                              ${Number(p.monto_total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {!isCancelled ? (
                                <button
                                  onClick={() => {
                                    setCancelPago(p);
                                    setMotivoCancelacion("");
                                  }}
                                  className="text-[11px] font-bold text-rose-600 hover:underline"
                                >
                                  Cancelar
                                </button>
                              ) : (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
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
        {/* TAB 3: CAJA CHICA (ENTRADAS / SALIDAS)                    */}
        {/* ========================================================= */}
        {activeTab === "CajaChica" && (
          <div className="flex flex-col gap-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Movimientos de Caja Chica y Fondo de Gaveta ({movimientosCaja.length})
                  </h2>
                </div>
                <button
                  onClick={() => setIsCajaModalOpen(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus size={14} /> Nuevo Movimiento
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Concepto</th>
                      <th className="py-3 px-4">Método</th>
                      <th className="py-3 px-4">Responsable</th>
                      <th className="py-3 px-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movimientosCaja.map((m) => {
                      const isInflow = m.tipo === "Fondo Inicial" || m.tipo === "Ingreso Extra";
                      return (
                        <tr key={m.id}>
                          <td className="py-2.5 px-4 font-bold">
                            <span className={isInflow ? "text-emerald-700" : "text-rose-700"}>
                              {m.tipo}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium">{m.concepto}</td>
                          <td className="py-2.5 px-4 text-slate-500">{m.metodo}</td>
                          <td className="py-2.5 px-4 text-slate-500">{m.responsable}</td>
                          <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                            {isInflow ? "+" : "-"}${Number(m.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
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
        {/* TAB 4: COMISIONES DE TÉCNICOS (NÓMINA OPERATIVA)          */}
        {/* ========================================================= */}
        {activeTab === "Comisiones" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {resumenMecanicos.map((m) => {
                const isSelected = selectedMecanicoId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMecanicoId(isSelected ? "ALL" : m.id)}
                    className={`cursor-pointer rounded-xl p-4 border transition-all bg-white shadow-xs ${
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm">{m.nombre}</h3>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {Number(m.comision_porcentaje || 25)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-3 pt-3 border-t border-slate-100">
                      <span className="text-slate-500">{m.totalHoras.toFixed(1)} hrs facturadas</span>
                      <span className="font-bold text-emerald-600 text-sm">
                        ${m.totalComision.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Desglose de Mano de Obra y Comisiones ({filteredDesgloseMecanicos.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Técnico</th>
                      <th className="py-2.5 px-4">Orden</th>
                      <th className="py-2.5 px-4">Servicio</th>
                      <th className="py-2.5 px-4 text-center">Horas</th>
                      <th className="py-2.5 px-4 text-right">Comisión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDesgloseMecanicos.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{item.mecanicoNombre}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-primary">#{1000 + Number(item.folio || 1)}</td>
                        <td className="py-2.5 px-4 text-slate-700">{item.servicioNombre}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-500">{item.horas}h</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600 tabular-nums">
                          ${item.comision.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
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

      {/* RECEIPT MODAL */}
      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        order={receiptOrder}
        payment={receiptPayment}
        empresa={empresa}
        sucursal={sucursalActiva || sucursales[0]}
        cashGiven={receiptCashGiven}
        changeDue={receiptChangeDue}
      />

      {/* CANCEL PAYMENT MODAL */}
      {cancelPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4">
            <h3 className="text-base font-bold text-slate-900">Cancelar Pago Registrado</h3>
            <p className="text-xs text-slate-500">
              Esta acción anulará el pago de ${Number(cancelPago.monto_total).toLocaleString("es-MX")} y revertirá el estatus de la orden. Ingresa el motivo para el registro de auditoría.
            </p>
            <textarea
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.target.value)}
              placeholder="Ej: Error de digitación, pago duplicado en terminal, cheque devuelto..."
              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs h-24 focus:outline-none focus:border-rose-600"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelPago(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmarCancelacion}
                disabled={savingCancel || !motivoCancelacion.trim()}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {savingCancel ? "Anulando..." : "Confirmar Anulación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAJA CHICA MODAL */}
      {isCajaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4">
            <h3 className="text-base font-bold text-slate-900">Registrar Movimiento de Caja Chica</h3>
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tipo de Movimiento:</label>
                <select
                  value={movForm.tipo}
                  onChange={(e) => setMovForm({ ...movForm, tipo: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Gasto / Insumos">Gasto / Insumos de Taller (Salida)</option>
                  <option value="Pago Proveedor">Pago a Repartidor / Proveedor (Salida)</option>
                  <option value="Fondo Inicial">Fondo Inicial de Caja (Entrada)</option>
                  <option value="Ingreso Extra">Ingreso Extra (Entrada)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Concepto:</label>
                <input
                  type="text"
                  value={movForm.concepto}
                  onChange={(e) => setMovForm({ ...movForm, concepto: e.target.value })}
                  placeholder="Ej: Compra de carbuclean, pago a mototaxi refacciones..."
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Monto ($ MXN):</label>
                <input
                  type="number"
                  step="0.01"
                  value={movForm.monto}
                  onChange={(e) => setMovForm({ ...movForm, monto: e.target.value })}
                  placeholder="0.00"
                  className="w-full p-2 border border-slate-200 rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsCajaModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveMovimiento}
                disabled={savingMov || !movForm.concepto.trim() || !movForm.monto}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
              >
                {savingMov ? "Guardando..." : "Guardar Movimiento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
