"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/context/TenantContext";
import { generatePaymentLink } from "@/app/actions/payments";
import { OrderPrintSheet } from "./OrderPrintSheet";
import {
  Loader2,
  User,
  Car,
  Clock,
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  Package,
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
  FileText,
  ClipboardCheck,
  Printer,
  ArrowRight,
  Calculator,
  TrendingUp,
  History,
  Check,
  Save,
  Sparkles,
  Camera,
  ShieldCheck,
  CircleDot,
} from "lucide-react";

interface OrderDetailsModalProps {
  orderId: string;
  onClose: () => void;
  onUpdate: () => void;
}

type WorkspaceTab = "cotizacion" | "dvi" | "pagos" | "impresion";

const PROVEEDORES_REFACCIONES = [
  "AutoZone Comercial",
  "Rolcar",
  "EuroPartes Monterrey",
  "Orma Autopartes",
  "Agencia OEM",
  "Brembo México",
];

const BAHIAS_TALLER = [
  "Rampa 1 (Alineación)",
  "Rampa 2 (Frenos / Susp.)",
  "Rampa 3 (Mecánica Gral.)",
  "Rampa 4 (Servicio Rápido)",
  "Bahía Diagnóstico",
  "Patio Entrega",
];

const CHECKLIST_ITEMS = [
  { key: "llanta_refaccion", label: "Llanta de refacción" },
  { key: "gato_herramienta", label: "Gato y herramienta" },
  { key: "tarjeta_circulacion", label: "Tarjeta de circulación" },
  { key: "objetos_valor", label: "Sin objetos de valor" },
  { key: "birlo_seguridad", label: "Birlo de seguridad" },
];

const DEFAULT_DVI_TEMPLATE = [
  {
    categoria: "Frenos",
    punto_inspeccion: "Balatas y Discos Delanteros / Traseros",
    severidad: "verde",
    observaciones: "Espesor dentro de rango operativo (>6mm).",
    recomendacion: "Limpieza y ajuste en próximo servicio.",
    costo_estimado: 0,
  },
  {
    categoria: "Suspensión y Dirección",
    punto_inspeccion: "Amortiguadores, Horquillas y Terminales",
    severidad: "verde",
    observaciones: "Sin fugas hidráulicas ni juego en rótulas.",
    recomendacion: "Verificar alineación cada 10,000 km.",
    costo_estimado: 0,
  },
  {
    categoria: "Neumáticos",
    punto_inspeccion: "Profundidad de Dibujo y Presión PSI",
    severidad: "amarillo",
    observaciones: "Desgaste ligero en hombros delanteros (4/32\").",
    recomendacion: "Rotación, balanceo y alineación por computadora.",
    costo_estimado: 930,
  },
  {
    categoria: "Motor y Fluidos",
    punto_inspeccion: "Aceite de Motor, Anticongelante y Líquido de Frenos",
    severidad: "verde",
    observaciones: "Niveles completos y viscosidad adecuada.",
    recomendacion: "Cambio programado en 5,000 km.",
    costo_estimado: 0,
  },
  {
    categoria: "Sistema Eléctrico",
    punto_inspeccion: "Batería (CCA), Alternador y Luces Exteriores",
    severidad: "verde",
    observaciones: "Voltaje de carga 14.1V estable.",
    recomendacion: "Sin acción requerida.",
    costo_estimado: 0,
  },
  {
    categoria: "Seguridad y Chasis",
    punto_inspeccion: "Bandas, Mangueras, Escape y Limpiaparabrisas",
    severidad: "verde",
    observaciones: "Sin grietas ni fugas visibles en línea inferior.",
    recomendacion: "Revisión visual completada.",
    costo_estimado: 0,
  },
];

export function OrderDetailsModal({ orderId, onClose, onUpdate }: OrderDetailsModalProps) {
  const { empresa, sucursalActiva } = useTenant();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("cotizacion");
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [availableTires, setAvailableTires] = useState<any[]>([]);
  const [deferredWorks, setDeferredWorks] = useState<any[]>([]);
  const [activePaymentProviders, setActivePaymentProviders] = useState<any[]>([]);

  // Labor state
  const [isAddingService, setIsAddingService] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceMechanicId, setServiceMechanicId] = useState("");
  const [servicePrice, setServicePrice] = useState<string>("");
  const [serviceHours, setServiceHours] = useState<string>("1.0");
  const [serviceCommission, setServiceCommission] = useState<string>("15");
  const [serviceNotes, setServiceNotes] = useState<string>("");
  const [addingServiceLoading, setAddingServiceLoading] = useState(false);

  // Buyout Refacciones state (Margin Calculator)
  const [isAddingPart, setIsAddingPart] = useState(false);
  const [partNombre, setPartNombre] = useState("");
  const [partNumero, setPartNumero] = useState("");
  const [partProveedor, setPartProveedor] = useState(PROVEEDORES_REFACCIONES[0]);
  const [partCantidad, setPartCantidad] = useState<number>(1);
  const [partCostoUnitario, setPartCostoUnitario] = useState<string>("");
  const [partMargen, setPartMargen] = useState<string>(
    String(empresa?.margen_refacciones_default ?? 35)
  );
  const [addingPartLoading, setAddingPartLoading] = useState(false);

  // Tires state
  const [isAddingTire, setIsAddingTire] = useState(false);
  const [selectedTireId, setSelectedTireId] = useState("");
  const [selectedTireQty, setSelectedTireQty] = useState(1);
  const [addingTireLoading, setAddingTireLoading] = useState(false);

  // DVI & Reception state
  const [dviItems, setDviItems] = useState<any[]>([]);
  const [isAddingDvi, setIsAddingDvi] = useState(false);
  const [newDviCategoria, setNewDviCategoria] = useState("Frenos");
  const [newDviPunto, setNewDviPunto] = useState("");
  const [newDviSeveridad, setNewDviSeveridad] = useState<"verde" | "amarillo" | "rojo">("amarillo");
  const [newDviObs, setNewDviObs] = useState("");
  const [newDviRec, setNewDviRec] = useState("");
  const [newDviCosto, setNewDviCosto] = useState("");
  const [newDviFoto, setNewDviFoto] = useState("");
  const [savingDviLoading, setSavingDviLoading] = useState(false);

  // Reception fields state
  const [recProblema, setRecProblema] = useState("");
  const [recDiagnostico, setRecDiagnostico] = useState("");
  const [recBahia, setRecBahia] = useState("");
  const [recKilometraje, setRecKilometraje] = useState<string>("");
  const [recGasolina, setRecGasolina] = useState("1/2");
  const [recChecklist, setRecChecklist] = useState<Record<string, boolean>>({
    llanta_refaccion: true,
    gato_herramienta: true,
    tarjeta_circulacion: true,
    objetos_valor: false,
    birlo_seguridad: true,
  });
  const [savingReception, setSavingReception] = useState(false);
  const [receptionSavedToast, setReceptionSavedToast] = useState(false);

  // Payments state
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentProvider, setPaymentProvider] = useState("Efectivo");
  const [paymentMetodoDetalle, setPaymentMetodoDetalle] = useState("Efectivo en Caja");
  const [paymentReferencia, setPaymentReferencia] = useState("");
  const [paymentMode, setPaymentMode] = useState<"directo" | "link">("directo");
  const [addingPaymentLoading, setAddingPaymentLoading] = useState(false);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState("");

  useEffect(() => {
    if (empresa?.margen_refacciones_default) {
      setPartMargen(String(empresa.margen_refacciones_default));
    }
  }, [empresa?.margen_refacciones_default]);

  const loadWorkspaceData = async () => {
    if (!orderId) return;
    setLoading(true);

    const [
      { data: orderData, error: orderError },
      { data: mechData },
      { data: srvData },
      { data: tiresData },
      { data: providersData },
      { data: dviData },
    ] = await Promise.all([
      supabase
        .from("ordenes_servicio")
        .select(
          `
          *,
          vehiculos (
            id, marca, modelo, anio, color, placas, vin, medida_oem, kilometraje_actual,
            clientes ( id, nombre, telefono, correo, rfc, empresa )
          ),
          orden_servicio_servicios (
            id, servicio_id, mecanico_id, cantidad, horas_labor, precio_cobrado, comision_porcentaje, estatus_aprobacion, notas,
            servicios_taller ( id, nombre, codigo_sku, categoria, horas_estimadas, precio )
          ),
          orden_servicio_refacciones (
            id, nombre, numero_parte, proveedor, cantidad, costo_unitario, margen_porcentaje, precio_unitario, subtotal, estatus_aprobacion
          ),
          cotizaciones (
            id, total,
            detalles_cotizacion (
              id, cantidad, precio_unitario, subtotal, estatus_aprobacion,
              inventario_llantas ( id, marca, modelo_llanta, rin, ancho, perfil, stock_actual, costo_adquisicion )
            )
          ),
          pagos_orden (
            id, monto_total, proveedor_pago, metodo_detalle, referencia, estatus, external_transaction_id, comision_pasarela, fecha_pago, deleted_at
          )
        `
        )
        .eq("id", orderId)
        .single(),
      supabase.from("empleados").select("*").eq("activo", true).order("nombre"),
      supabase.from("servicios_taller").select("*").eq("activo", true).order("nombre"),
      supabase.from("inventario_llantas").select("*").gt("stock_actual", 0).order("marca"),
      supabase.from("configuracion_pagos").select("*").eq("activo", true),
      supabase
        .from("inspecciones_dvi")
        .select("*")
        .eq("orden_servicio_id", orderId)
        .order("created_at", { ascending: true }),
    ]);

    if (!orderError && orderData) {
      const activePagos = (orderData.pagos_orden || []).filter((p: any) => !p.deleted_at);
      const enrichedOrder = {
        ...orderData,
        pagos_orden: activePagos,
        inspecciones_dvi: dviData || [],
      };
      setOrder(enrichedOrder);
      setDviItems(dviData || []);

      // Init reception fields
      setRecProblema(orderData.problema_reportado || orderData.notas_recepcion || "");
      setRecDiagnostico(orderData.diagnostico_tecnico || "");
      setRecBahia(orderData.bahia_rampa || "");
      setRecKilometraje(String(orderData.kilometraje_ingreso || ""));
      setRecGasolina(orderData.nivel_gasolina || "1/2");
      if (orderData.checklist_recepcion && typeof orderData.checklist_recepcion === "object") {
        setRecChecklist(orderData.checklist_recepcion as Record<string, boolean>);
      }
      setServiceMechanicId(orderData.mecanico_id || "");

      // Load unresolved deferred works for this vehicle
      if (orderData.vehiculo_id) {
        const { data: difData } = await supabase
          .from("trabajos_diferidos")
          .select("*")
          .eq("vehiculo_id", orderData.vehiculo_id)
          .eq("resuelto", false)
          .order("created_at", { ascending: false });
        if (difData) setDeferredWorks(difData);
      }
    }

    if (mechData) setMechanics(mechData);
    if (srvData) setAvailableServices(srvData);
    if (tiresData) setAvailableTires(tiresData);
    if (providersData) setActivePaymentProviders(providersData);

    setLoading(false);
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [orderId]);

  // Financial & Profitability calculations
  const servicesList = order?.orden_servicio_servicios || [];
  const partsList = order?.orden_servicio_refacciones || [];
  const tiresList = order?.cotizaciones?.detalles_cotizacion || [];
  const pagosList = order?.pagos_orden || [];

  const activeServices = servicesList.filter((s: any) => s.estatus_aprobacion !== "Diferido");
  const activeParts = partsList.filter((r: any) => r.estatus_aprobacion !== "Diferido");
  const activeTires = tiresList.filter((t: any) => t.estatus_aprobacion !== "Diferido");

  const subtotalServicios = activeServices.reduce(
    (acc: number, s: any) => acc + Number(s.precio_cobrado || 0) * Number(s.cantidad || 1),
    0
  );
  const subtotalRefacciones = activeParts.reduce(
    (acc: number, r: any) => acc + Number(r.subtotal || 0),
    0
  );
  const costoRefacciones = activeParts.reduce(
    (acc: number, r: any) => acc + Number(r.costo_unitario || 0) * Number(r.cantidad || 1),
    0
  );
  const subtotalLlantas = activeTires.reduce(
    (acc: number, t: any) => acc + Number(t.subtotal || 0),
    0
  );
  const costoLlantas = activeTires.reduce(
    (acc: number, t: any) =>
      acc +
      Number(t.inventario_llantas?.costo_adquisicion || Number(t.precio_unitario || 0) * 0.72) *
        Number(t.cantidad || 1),
    0
  );

  const comisionTecnicoTotal = activeServices.reduce((acc: number, s: any) => {
    const lineTotal = Number(s.precio_cobrado || 0) * Number(s.cantidad || 1);
    const pct = Number(s.comision_porcentaje ?? 15);
    return acc + lineTotal * (pct / 100);
  }, 0);

  const granTotal = subtotalServicios + subtotalRefacciones + subtotalLlantas;
  const costoTotalDirecto = costoRefacciones + costoLlantas + comisionTecnicoTotal;
  const utilidadBruta = granTotal - costoTotalDirecto;
  const margenBrutoPct = granTotal > 0 ? (utilidadBruta / granTotal) * 100 : 0;

  const totalPagado = pagosList
    .filter((p: any) => p.estatus === "Aprobado" && !p.deleted_at)
    .reduce((acc: number, p: any) => acc + Number(p.monto_total || 0), 0);
  const saldoPendiente = Math.max(0, granTotal - totalPagado);

  // Live Buyout Margin Calculator values
  const numericCosto = parseFloat(partCostoUnitario) || 0;
  const numericMargen = parseFloat(partMargen) || 0;
  const numericCant = Math.max(1, Number(partCantidad) || 1);
  const calcPrecioUnitario = Math.round(numericCosto * (1 + numericMargen / 100) * 100) / 100;
  const calcSubtotal = Math.round(calcPrecioUnitario * numericCant * 100) / 100;
  const calcUtilidad = Math.round((calcSubtotal - numericCosto * numericCant) * 100) / 100;

  // Handlers for Order Header
  const handleUpdateStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from("ordenes_servicio")
      .update({ estado: newStatus })
      .eq("id", orderId);
    if (!error) {
      setOrder((prev: any) => ({ ...prev, estado: newStatus }));
      onUpdate();
    }
  };

  const handleUpdateSubStatus = async (newSubStatus: string) => {
    const { error } = await supabase
      .from("ordenes_servicio")
      .update({ sub_estado: newSubStatus })
      .eq("id", orderId);
    if (!error) {
      setOrder((prev: any) => ({ ...prev, sub_estado: newSubStatus }));
      onUpdate();
    }
  };

  const handleUpdateMechanic = async (mechanicId: string) => {
    const val = mechanicId === "" ? null : mechanicId;
    const { error } = await supabase
      .from("ordenes_servicio")
      .update({ mecanico_id: val })
      .eq("id", orderId);
    if (!error) {
      setOrder((prev: any) => ({ ...prev, mecanico_id: val }));
      setServiceMechanicId(val || "");
      onUpdate();
    }
  };

  // Handler: Add Deferred Work to Current Order
  const handleAddDeferredToOrder = async (dif: any) => {
    // Check if there is a matching service in servicios_taller
    const matchedService = availableServices.find(
      (s) =>
        s.nombre.toLowerCase().includes(dif.concepto.toLowerCase()) ||
        dif.concepto.toLowerCase().includes(s.nombre.toLowerCase())
    );

    if (matchedService) {
      const mech = mechanics.find((m) => m.id === (order.mecanico_id || serviceMechanicId));
      const { data: newSrv } = await supabase
        .from("orden_servicio_servicios")
        .insert({
          orden_servicio_id: orderId,
          servicio_id: matchedService.id,
          mecanico_id: order.mecanico_id || null,
          cantidad: 1,
          horas_labor: matchedService.horas_estimadas || 1.0,
          precio_cobrado: dif.costo_estimado || matchedService.precio,
          comision_porcentaje: mech?.comision_porcentaje ?? 15,
          estatus_aprobacion: "Aprobado",
          notas: `Recuperado de trabajo diferido: ${dif.concepto}`,
        })
        .select(
          "id, servicio_id, mecanico_id, cantidad, horas_labor, precio_cobrado, comision_porcentaje, estatus_aprobacion, notas, servicios_taller(id, nombre, codigo_sku, categoria, horas_estimadas, precio)"
        )
        .single();

      if (newSrv) {
        setOrder((prev: any) => ({
          ...prev,
          orden_servicio_servicios: [...(prev.orden_servicio_servicios || []), newSrv],
        }));
      }
    } else {
      // Insert as Buyout / Part in orden_servicio_refacciones
      const precioVenta = Number(dif.costo_estimado || 1200);
      const margenDefault = Number(empresa?.margen_refacciones_default ?? 35);
      const costoEst = Math.round((precioVenta / (1 + margenDefault / 100)) * 100) / 100;

      const { data: newPart } = await supabase
        .from("orden_servicio_refacciones")
        .insert({
          orden_servicio_id: orderId,
          nombre: dif.concepto,
          numero_parte: "DIF-REC",
          proveedor: "AutoZone Comercial",
          cantidad: 1,
          costo_unitario: costoEst,
          margen_porcentaje: margenDefault,
          precio_unitario: precioVenta,
          subtotal: precioVenta,
          estatus_aprobacion: "Aprobado",
        })
        .select("*")
        .single();

      if (newPart) {
        setOrder((prev: any) => ({
          ...prev,
          orden_servicio_refacciones: [...(prev.orden_servicio_refacciones || []), newPart],
        }));
      }
    }

    await supabase.from("trabajos_diferidos").update({ resuelto: true }).eq("id", dif.id);
    setDeferredWorks((prev) => prev.filter((item) => item.id !== dif.id));
    onUpdate();
  };

  // Handlers for Labor (Mano de Obra)
  const handleSelectCatalogService = (srvId: string) => {
    setSelectedServiceId(srvId);
    const srv = availableServices.find((s) => s.id === srvId);
    if (srv) {
      setServicePrice(String(srv.precio || 0));
      setServiceHours(String(srv.horas_estimadas || 1.0));
    }
    const mech = mechanics.find((m) => m.id === (serviceMechanicId || order?.mecanico_id));
    if (mech?.comision_porcentaje) {
      setServiceCommission(String(mech.comision_porcentaje));
    }
  };

  const handleAddService = async () => {
    if (!selectedServiceId) return;
    const service = availableServices.find((s) => s.id === selectedServiceId);
    if (!service) return;
    setAddingServiceLoading(true);

    const payload = {
      orden_servicio_id: orderId,
      servicio_id: service.id,
      mecanico_id: serviceMechanicId || order.mecanico_id || null,
      cantidad: 1,
      horas_labor: parseFloat(serviceHours) || Number(service.horas_estimadas || 1),
      precio_cobrado: parseFloat(servicePrice) || Number(service.precio || 0),
      comision_porcentaje: parseFloat(serviceCommission) || 15,
      estatus_aprobacion: "Aprobado",
      notas: serviceNotes.trim() || null,
    };

    const { data, error } = await supabase
      .from("orden_servicio_servicios")
      .insert(payload)
      .select(
        "id, servicio_id, mecanico_id, cantidad, horas_labor, precio_cobrado, comision_porcentaje, estatus_aprobacion, notas, servicios_taller(id, nombre, codigo_sku, categoria, horas_estimadas, precio)"
      )
      .single();

    if (!error && data) {
      setOrder((prev: any) => ({
        ...prev,
        orden_servicio_servicios: [...(prev.orden_servicio_servicios || []), data],
      }));
      setIsAddingService(false);
      setSelectedServiceId("");
      setServiceNotes("");
      onUpdate();
    }
    setAddingServiceLoading(false);
  };

  const handleToggleServiceApproval = async (row: any) => {
    const nextStatus = row.estatus_aprobacion === "Aprobado" ? "Pendiente" : "Aprobado";
    const { error } = await supabase
      .from("orden_servicio_servicios")
      .update({ estatus_aprobacion: nextStatus })
      .eq("id", row.id);
    if (!error) {
      setOrder((prev: any) => ({
        ...prev,
        orden_servicio_servicios: prev.orden_servicio_servicios.map((s: any) =>
          s.id === row.id ? { ...s, estatus_aprobacion: nextStatus } : s
        ),
      }));
      onUpdate();
    }
  };

  const handleDeferService = async (row: any) => {
    const { error } = await supabase
      .from("orden_servicio_servicios")
      .update({ estatus_aprobacion: "Diferido" })
      .eq("id", row.id);

    if (!error) {
      // Also create a record in trabajos_diferidos
      const v = order.vehiculos;
      const c = v?.clientes;
      if (v?.id && c?.id) {
        const { data: newDif } = await supabase
          .from("trabajos_diferidos")
          .insert({
            vehiculo_id: v.id,
            cliente_id: c.id,
            orden_origen_id: orderId,
            concepto: row.servicios_taller?.nombre || "Servicio Diferido",
            categoria: row.servicios_taller?.categoria || "Mecánica General",
            severidad: "amarillo",
            costo_estimado: Number(row.precio_cobrado || 0),
            notas: row.notas || "Diferido desde orden de servicio",
            resuelto: false,
          })
          .select("*")
          .single();
        if (newDif) {
          setDeferredWorks((prev) => [newDif, ...prev]);
        }
      }

      setOrder((prev: any) => ({
        ...prev,
        orden_servicio_servicios: prev.orden_servicio_servicios.map((s: any) =>
          s.id === row.id ? { ...s, estatus_aprobacion: "Diferido" } : s
        ),
      }));
      onUpdate();
    }
  };

  const handleRemoveService = async (relationId: string) => {
    const { error } = await supabase
      .from("orden_servicio_servicios")
      .delete()
      .eq("id", relationId);
    if (!error) {
      setOrder((prev: any) => ({
        ...prev,
        orden_servicio_servicios: prev.orden_servicio_servicios.filter(
          (s: any) => s.id !== relationId
        ),
      }));
      onUpdate();
    }
  };

  // Handlers for Buyout Parts (Refacciones Sobre Pedido)
  const handleAddPart = async () => {
    if (!partNombre.trim() || numericCosto <= 0) return;
    setAddingPartLoading(true);

    const payload = {
      orden_servicio_id: orderId,
      nombre: partNombre.trim(),
      numero_parte: partNumero.trim() || null,
      proveedor: partProveedor,
      cantidad: numericCant,
      costo_unitario: numericCosto,
      margen_porcentaje: numericMargen,
      precio_unitario: calcPrecioUnitario,
      subtotal: calcSubtotal,
      estatus_aprobacion: "Aprobado",
    };

    const { data, error } = await supabase
      .from("orden_servicio_refacciones")
      .insert(payload)
      .select("*")
      .single();

    if (!error && data) {
      setOrder((prev: any) => ({
        ...prev,
        orden_servicio_refacciones: [...(prev.orden_servicio_refacciones || []), data],
      }));
      setIsAddingPart(false);
      setPartNombre("");
      setPartNumero("");
      setPartCantidad(1);
      setPartCostoUnitario("");
      onUpdate();
    }
    setAddingPartLoading(false);
  };

  const handleDeferPart = async (part: any) => {
    const { error } = await supabase
      .from("orden_servicio_refacciones")
      .update({ estatus_aprobacion: "Diferido" })
      .eq("id", part.id);

    if (!error) {
      const v = order.vehiculos;
      const c = v?.clientes;
      if (v?.id && c?.id) {
        const { data: newDif } = await supabase
          .from("trabajos_diferidos")
          .insert({
            vehiculo_id: v.id,
            cliente_id: c.id,
            orden_origen_id: orderId,
            concepto: `${part.nombre} (${part.numero_parte || part.proveedor || "Refacción"})`,
            categoria: "Refacciones",
            severidad: "amarillo",
            costo_estimado: Number(part.subtotal || 0),
            notas: `Proveedor: ${part.proveedor || "Externo"}`,
            resuelto: false,
          })
          .select("*")
          .single();
        if (newDif) setDeferredWorks((prev) => [newDif, ...prev]);
      }

      setOrder((prev: any) => ({
        ...prev,
        orden_servicio_refacciones: prev.orden_servicio_refacciones.map((r: any) =>
          r.id === part.id ? { ...r, estatus_aprobacion: "Diferido" } : r
        ),
      }));
      onUpdate();
    }
  };

  const handleRemovePart = async (partId: string) => {
    const { error } = await supabase
      .from("orden_servicio_refacciones")
      .delete()
      .eq("id", partId);
    if (!error) {
      setOrder((prev: any) => ({
        ...prev,
        orden_servicio_refacciones: prev.orden_servicio_refacciones.filter(
          (r: any) => r.id !== partId
        ),
      }));
      onUpdate();
    }
  };

  // Handlers for Stock Tires
  const handleAddTire = async () => {
    if (!selectedTireId || selectedTireQty < 1) return;
    const tire = availableTires.find((t) => t.id === selectedTireId);
    if (!tire) return;
    setAddingTireLoading(true);

    let currentCotizacionId = order.cotizacion_id;
    if (!currentCotizacionId) {
      const { data: newCotizacion, error: cotError } = await supabase
        .from("cotizaciones")
        .insert({
          cliente_id: order.vehiculos.clientes.id,
          vehiculo_id: order.vehiculos.id,
          estatus: "Aprobada",
          total: tire.precio_venta * selectedTireQty,
        })
        .select("id")
        .single();
      if (!cotError && newCotizacion) {
        currentCotizacionId = newCotizacion.id;
        await supabase
          .from("ordenes_servicio")
          .update({ cotizacion_id: currentCotizacionId })
          .eq("id", orderId);
      }
    }

    if (currentCotizacionId) {
      const subtotalItem = Number(tire.precio_venta) * selectedTireQty;
      const { data: newDetail, error: detailError } = await supabase
        .from("detalles_cotizacion")
        .insert({
          cotizacion_id: currentCotizacionId,
          llanta_id: tire.id,
          cantidad: selectedTireQty,
          precio_unitario: tire.precio_venta,
          subtotal: subtotalItem,
          estatus_aprobacion: "Aprobado",
        })
        .select(
          "id, cantidad, precio_unitario, subtotal, estatus_aprobacion, inventario_llantas(id, marca, modelo_llanta, rin, ancho, perfil, stock_actual, costo_adquisicion)"
        )
        .single();

      if (!detailError && newDetail) {
        await supabase
          .from("inventario_llantas_base")
          .update({ stock_actual: Math.max(0, Number(tire.stock_actual) - selectedTireQty) })
          .eq("id", tire.id);

        const updatedCotizaciones = order.cotizaciones || { detalles_cotizacion: [] };
        setOrder((prev: any) => ({
          ...prev,
          cotizacion_id: currentCotizacionId,
          cotizaciones: {
            ...updatedCotizaciones,
            detalles_cotizacion: [...(updatedCotizaciones.detalles_cotizacion || []), newDetail],
          },
        }));
        setAvailableTires((prev) =>
          prev.map((t) =>
            t.id === tire.id ? { ...t, stock_actual: Number(t.stock_actual) - selectedTireQty } : t
          )
        );
        setIsAddingTire(false);
        setSelectedTireId("");
        setSelectedTireQty(1);
        onUpdate();
      }
    }
    setAddingTireLoading(false);
  };

  const handleRemoveTire = async (detail: any) => {
    const { error } = await supabase.from("detalles_cotizacion").delete().eq("id", detail.id);
    if (!error) {
      const tire = detail.inventario_llantas;
      if (tire?.id) {
        await supabase
          .from("inventario_llantas_base")
          .update({ stock_actual: Number(tire.stock_actual || 0) + Number(detail.cantidad || 1) })
          .eq("id", tire.id);
      }
      const updatedDetalles = (order.cotizaciones?.detalles_cotizacion || []).filter(
        (d: any) => d.id !== detail.id
      );
      setOrder((prev: any) => ({
        ...prev,
        cotizaciones: { ...prev.cotizaciones, detalles_cotizacion: updatedDetalles },
      }));
      onUpdate();
    }
  };

  // Handlers for Persistent DVI & Reception
  const handleLoadDviTemplate = async () => {
    setSavingDviLoading(true);
    const rows = DEFAULT_DVI_TEMPLATE.map((item) => ({
      ...item,
      orden_servicio_id: orderId,
      estatus_cliente: "Pendiente",
    }));
    const { data, error } = await supabase.from("inspecciones_dvi").insert(rows).select("*");
    if (!error && data) {
      setDviItems(data);
      setOrder((prev: any) => ({ ...prev, inspecciones_dvi: data }));
      onUpdate();
    }
    setSavingDviLoading(false);
  };

  const handleAddDviPoint = async () => {
    if (!newDviPunto.trim()) return;
    setSavingDviLoading(true);
    const { data, error } = await supabase
      .from("inspecciones_dvi")
      .insert({
        orden_servicio_id: orderId,
        categoria: newDviCategoria,
        punto_inspeccion: newDviPunto.trim(),
        severidad: newDviSeveridad,
        observaciones: newDviObs.trim() || null,
        recomendacion: newDviRec.trim() || null,
        costo_estimado: parseFloat(newDviCosto) || 0,
        foto_url: newDviFoto.trim() || null,
        estatus_cliente: "Pendiente",
      })
      .select("*")
      .single();

    if (!error && data) {
      const next = [...dviItems, data];
      setDviItems(next);
      setOrder((prev: any) => ({ ...prev, inspecciones_dvi: next }));
      setIsAddingDvi(false);
      setNewDviPunto("");
      setNewDviObs("");
      setNewDviRec("");
      setNewDviCosto("");
      setNewDviFoto("");
      onUpdate();
    }
    setSavingDviLoading(false);
  };

  const handleUpdateDviItem = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("inspecciones_dvi").update(updates).eq("id", id);
    if (!error) {
      const next = dviItems.map((item) => (item.id === id ? { ...item, ...updates } : item));
      setDviItems(next);
      setOrder((prev: any) => ({ ...prev, inspecciones_dvi: next }));
      onUpdate();
    }
  };

  const handleRemoveDviItem = async (id: string) => {
    const { error } = await supabase.from("inspecciones_dvi").delete().eq("id", id);
    if (!error) {
      const next = dviItems.filter((item) => item.id !== id);
      setDviItems(next);
      setOrder((prev: any) => ({ ...prev, inspecciones_dvi: next }));
      onUpdate();
    }
  };

  const handleSendDviToDeferred = async (item: any) => {
    const v = order.vehiculos;
    const c = v?.clientes;
    if (!v?.id || !c?.id) return;

    const { data: newDif, error } = await supabase
      .from("trabajos_diferidos")
      .insert({
        vehiculo_id: v.id,
        cliente_id: c.id,
        orden_origen_id: orderId,
        concepto: `${item.punto_inspeccion} - ${item.recomendacion || item.observaciones || "Hallazgo DVI"}`,
        categoria: item.categoria || "DVI",
        severidad: item.severidad === "rojo" ? "rojo" : "amarillo",
        costo_estimado: Number(item.costo_estimado || 1200),
        notas: item.observaciones || "Detectado en Inspección Digital Multipunto",
        resuelto: false,
      })
      .select("*")
      .single();

    if (!error && newDif) {
      setDeferredWorks((prev) => [newDif, ...prev]);
      await handleUpdateDviItem(item.id, { estatus_cliente: "Diferido" });
    }
  };

  const handleSaveReception = async () => {
    setSavingReception(true);
    const km = parseInt(recKilometraje) || order.kilometraje_ingreso || 0;
    const updates = {
      problema_reportado: recProblema.trim() || null,
      notas_recepcion: recProblema.trim() || null,
      diagnostico_tecnico: recDiagnostico.trim() || null,
      bahia_rampa: recBahia || null,
      kilometraje_ingreso: km,
      nivel_gasolina: recGasolina,
      checklist_recepcion: recChecklist,
    };

    const { error } = await supabase.from("ordenes_servicio").update(updates).eq("id", orderId);
    if (!error) {
      setOrder((prev: any) => ({ ...prev, ...updates }));
      setReceptionSavedToast(true);
      setTimeout(() => setReceptionSavedToast(false), 2500);
      onUpdate();
    }
    setSavingReception(false);
  };

  // Handlers for Payments
  const handleAddPayment = async () => {
    const monto = parseFloat(paymentAmount);
    if (isNaN(monto) || monto <= 0) return;
    setAddingPaymentLoading(true);

    const providerConfig = activePaymentProviders.find((p) => p.proveedor === paymentProvider);
    const comision =
      paymentProvider === "Efectivo" || paymentProvider === "Transferencia"
        ? 0
        : providerConfig
        ? monto * (Number(providerConfig.comision_porcentaje) / 100)
        : monto * 0.035;

    if (paymentMode === "link" && ["Mercado Pago", "KueskiPay", "Atrato"].includes(paymentProvider)) {
      setPaymentStatusMessage(`Generando link de pago con ${paymentProvider}...`);
      const mappedProvider =
        paymentProvider === "Mercado Pago" ? "MercadoPago" : (paymentProvider as any);
      const res = await generatePaymentLink(orderId, monto, mappedProvider);
      if (res.success && res.payment_url) {
        window.open(res.payment_url, "_blank");
      }
      await loadWorkspaceData();
      setIsAddingPayment(false);
      setPaymentAmount("");
      setPaymentStatusMessage("");
      setAddingPaymentLoading(false);
      onUpdate();
      return;
    }

    const payload = {
      orden_servicio_id: orderId,
      sucursal_id: order.sucursal_id || sucursalActiva?.id || null,
      monto_total: monto,
      proveedor_pago: paymentProvider,
      metodo_detalle: paymentMetodoDetalle || paymentProvider,
      referencia: paymentReferencia.trim() || `AUT-${Date.now().toString().slice(-6)}`,
      estatus: "Aprobado",
      comision_pasarela: Math.round(comision * 100) / 100,
    };

    const { data: intent, error } = await supabase
      .from("pagos_orden")
      .insert(payload)
      .select("*")
      .single();

    if (!error && intent) {
      const newPagos = [...(order.pagos_orden || []), intent];
      const newTotalPagado = newPagos
        .filter((p: any) => p.estatus === "Aprobado" && !p.deleted_at)
        .reduce((acc: number, curr: any) => acc + Number(curr.monto_total), 0);

      let newEstatus = "Pendiente";
      if (newTotalPagado > 0 && newTotalPagado < granTotal) newEstatus = "Parcial";
      if (newTotalPagado >= granTotal && granTotal > 0) newEstatus = "Pagado";

      await supabase
        .from("ordenes_servicio")
        .update({ estatus_pago: newEstatus })
        .eq("id", orderId);

      setOrder((prev: any) => ({
        ...prev,
        pagos_orden: newPagos,
        estatus_pago: newEstatus,
      }));
      setIsAddingPayment(false);
      setPaymentAmount("");
      setPaymentReferencia("");
      onUpdate();
    }
    setAddingPaymentLoading(false);
  };

  const handleRemovePayment = async (pagoId: string) => {
    const { error } = await supabase
      .from("pagos_orden")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", pagoId);
    if (!error) {
      const newPagos = (order.pagos_orden || []).filter((p: any) => p.id !== pagoId);
      const newTotalPagado = newPagos
        .filter((p: any) => p.estatus === "Aprobado")
        .reduce((acc: number, curr: any) => acc + Number(curr.monto_total), 0);
      let newEstatus = "Pendiente";
      if (newTotalPagado > 0 && newTotalPagado < granTotal) newEstatus = "Parcial";
      if (newTotalPagado >= granTotal && granTotal > 0) newEstatus = "Pagado";
      await supabase
        .from("ordenes_servicio")
        .update({ estatus_pago: newEstatus })
        .eq("id", orderId);
      setOrder((prev: any) => ({ ...prev, pagos_orden: newPagos, estatus_pago: newEstatus }));
      onUpdate();
    }
  };

  if (loading || !order) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 size={26} className="animate-spin text-blue-600" />
        <p className="text-xs font-medium">Cargando estación de trabajo de la orden...</p>
      </div>
    );
  }

  const v = order.vehiculos || {};
  const c = v.clientes || {};
  const folioStr = `#${1000 + Number(order.folio || 1)}`;
  const assignedMechanic = mechanics.find((m) => m.id === order.mecanico_id);

  const handleSendWhatsApp = () => {
    const cleanPhone = (c.telefono || "8112345678").replace(/\D/g, "");
    const portalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/orden/${orderId}`;
    const msg = `Hola *${c.nombre || "Cliente"}*, te saludamos de *${
      empresa?.nombre_comercial || "Torque & Ruta"
    }*. 🚗\n\nTu unidad *${v.marca} ${v.modelo}* (${v.placas || "S/P"}) con Orden *${folioStr}* tiene lista su Inspección Digital Multipunto (DVI) y cotización por *$${granTotal.toLocaleString(
      "es-MX",
      { minimumFractionDigits: 2 }
    )} MXN*.\n\nPuedes revisar las fotos, el diagnóstico técnico y autorizar en 1 clic desde tu celular aquí:\n👉 ${portalUrl}`;

    window.open(
      `https://wa.me/52${cleanPhone.slice(-10)}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  };

  const dviRedCount = dviItems.filter((i) => i.severidad === "rojo").length;
  const dviYellowCount = dviItems.filter((i) => i.severidad === "amarillo").length;
  const dviGreenCount = dviItems.filter((i) => i.severidad === "verde").length;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-900">
      {/* Top Action Header Bar (Shopmonkey Style) */}
      <div className="bg-white px-5 py-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="px-2.5 py-1.5 rounded-md bg-slate-900 text-white font-mono text-sm font-black tracking-tight tabular-nums shrink-0">
            {folioStr}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/clientes/${c.id}?vehiculoId=${v.id}`}
                onClick={onClose}
                className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1.5"
              >
                {v.marca} {v.modelo} {v.anio ? `(${v.anio})` : ""}
                <ExternalLink size={13} className="text-slate-400" />
              </Link>
              <span className="font-mono text-xs font-bold uppercase bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded">
                {v.placas || "SIN PLACA"}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  order.estatus_pago === "Pagado"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : order.estatus_pago === "Parcial"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                Pago: {order.estatus_pago || "Pendiente"}
              </span>
              {order.aprobado_cliente_nombre && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <ShieldCheck size={11} /> Autorizado por {order.aprobado_cliente_nombre}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
              <Link
                href={`/clientes/${c.id}?vehiculoId=${v.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-blue-600 hover:underline"
              >
                <User size={12} className="text-slate-400" />
                {c.nombre}
              </Link>
              {c.telefono && <span className="tabular-nums">• Tel: {c.telefono}</span>}
              <span className="tabular-nums">
                • {Number(order.kilometraje_ingreso || 0).toLocaleString("es-MX")} km
              </span>
              {order.bahia_rampa && (
                <span className="text-slate-700 font-medium">• {order.bahia_rampa}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Controls: Portal Link, WhatsApp, Status Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/orden/${orderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-xs"
          >
            <ExternalLink size={13} className="text-blue-600" />
            Portal Cliente
          </a>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <MessageCircle size={13} />
            Enviar por WhatsApp
          </button>

          <select
            value={order.mecanico_id || ""}
            onChange={(e) => handleUpdateMechanic(e.target.value)}
            className="h-8 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md px-2.5 text-slate-800 focus:outline-none focus:border-blue-600"
            title="Técnico Asignado"
          >
            <option value="">Sin Técnico</option>
            {mechanics
              .filter((m) => m.rol === "Mecánico" || m.puesto?.toLowerCase().includes("técnico"))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  🔧 {m.nombre}
                </option>
              ))}
          </select>

          <select
            value={order.estado}
            onChange={(e) => handleUpdateStatus(e.target.value)}
            className="h-8 text-xs font-bold bg-slate-900 text-white border border-slate-900 rounded-md px-2.5 focus:outline-none cursor-pointer"
          >
            <option value="Citas del Día">1. Citas del Día</option>
            <option value="En Inspección">2. En Inspección</option>
            <option value="En Rampa">3. En Rampa</option>
            <option value="Listo para Entrega">4. Listo para Entrega</option>
          </select>

          <select
            value={order.sub_estado || "Activa"}
            onChange={(e) => handleUpdateSubStatus(e.target.value)}
            className="h-8 text-xs font-semibold bg-white border border-slate-300 rounded-md px-2.5 text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="Activa">Sub: Activa</option>
            <option value="Esperando Aprobación Cliente">Sub: Esperando Aprobación</option>
            <option value="En Reparación">Sub: En Reparación</option>
            <option value="Por Cobrar en Caja">Sub: Por Cobrar en Caja</option>
            <option value="Entregado">Sub: Entregado</option>
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white px-5 border-b border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("cotizacion")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "cotizacion"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calculator size={14} />
          1. Partidas y Cotización
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 tabular-nums">
            {activeServices.length + activeParts.length + activeTires.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dvi")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "dvi"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ClipboardCheck size={14} />
          2. Inspección Digital (DVI) y Recepción
          <span className="inline-flex items-center gap-1 ml-1">
            {dviRedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-100 text-red-700 font-bold tabular-nums">
                {dviRedCount}R
              </span>
            )}
            {dviYellowCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-700 font-bold tabular-nums">
                {dviYellowCount}A
              </span>
            )}
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-bold tabular-nums">
              {dviGreenCount}V
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pagos")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "pagos"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Banknote size={14} />
          3. Pagos y Cobranza
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 tabular-nums">
            {pagosList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("impresion")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "impresion"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Printer size={14} />
          4. Hoja de Recepción / Impresión
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-5">
        {/* TAB 1: PARTIDAS Y COTIZACIÓN */}
        {activeTab === "cotizacion" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 8 Cols: Deferred Banner + Labor + Buyouts + Tires */}
            <div className="lg:col-span-8 space-y-5">
              {/* Alert Banner for Unresolved Deferred Works */}
              {deferredWorks.length > 0 && (
                <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                        Trabajos Diferidos Pendientes en este Vehículo ({deferredWorks.length})
                      </h4>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      Oportunidad de Venta / Upsell
                    </span>
                  </div>
                  <div className="divide-y divide-amber-200/70">
                    {deferredWorks.map((dif) => (
                      <div
                        key={dif.id}
                        className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span
                            className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                              dif.severidad === "rojo" ? "bg-red-600" : "bg-amber-500"
                            }`}
                          />
                          <strong className="text-slate-900">{dif.concepto}</strong>
                          {dif.categoria && (
                            <span className="text-slate-500 ml-1.5">({dif.categoria})</span>
                          )}
                          {dif.notas && (
                            <p className="text-[11px] text-slate-600 ml-3.5">{dif.notas}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {dif.costo_estimado && (
                            <span className="font-mono font-bold text-slate-900 tabular-nums">
                              Est: ${Number(dif.costo_estimado).toLocaleString("es-MX")}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAddDeferredToOrder(dif)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <Plus size={12} /> Agregar a esta Orden
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. MANO DE OBRA (SERVICIOS DE TALLER) */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench size={15} className="text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Mano de Obra y Servicios ({servicesList.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingService(!isAddingService)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus size={13} /> Agregar Mano de Obra
                  </button>
                </div>

                {isAddingService && (
                  <div className="p-4 bg-blue-50/40 border-b border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Servicio del Catálogo
                        </label>
                        <select
                          value={selectedServiceId}
                          onChange={(e) => handleSelectCatalogService(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-slate-900"
                        >
                          <option value="">Seleccionar servicio...</option>
                          {availableServices.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.codigo_sku ? `[${s.codigo_sku}] ` : ""}
                              {s.nombre} — ${Number(s.precio).toLocaleString("es-MX")}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Técnico Asignado
                        </label>
                        <select
                          value={serviceMechanicId}
                          onChange={(e) => setServiceMechanicId(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-slate-900"
                        >
                          <option value="">Técnico de la orden</option>
                          {mechanics
                            .filter((m) => m.rol === "Mecánico")
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nombre} ({m.comision_porcentaje || 15}%)
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Horas Labor
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={serviceHours}
                          onChange={(e) => setServiceHours(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-slate-900 tabular-nums"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Precio ($)
                        </label>
                        <input
                          type="number"
                          step="10"
                          value={servicePrice}
                          onChange={(e) => setServicePrice(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-slate-900 font-bold tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Notas técnicas de la partida (opcional)..."
                        value={serviceNotes}
                        onChange={(e) => setServiceNotes(e.target.value)}
                        className="w-full sm:flex-1 h-8 text-xs bg-white border border-slate-300 rounded-md px-2.5 text-slate-800"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsAddingService(false)}
                          className="px-3 h-8 text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={!selectedServiceId || addingServiceLoading}
                          onClick={handleAddService}
                          className="px-4 h-8 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          {addingServiceLoading ? "Guardando..." : "Guardar Mano de Obra"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {servicesList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No hay mano de obra cargada en esta orden.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] uppercase font-bold text-slate-500">
                          <th className="py-2 px-3">Servicio / Mano de Obra</th>
                          <th className="py-2 px-3">Técnico</th>
                          <th className="py-2 px-3 text-center">Hrs</th>
                          <th className="py-2 px-3 text-right">Comisión Téc.</th>
                          <th className="py-2 px-3 text-center">Estatus</th>
                          <th className="py-2 px-3 text-right">Importe</th>
                          <th className="py-2 px-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {servicesList.map((row: any) => {
                          const mech = mechanics.find(
                            (m) => m.id === (row.mecanico_id || order.mecanico_id)
                          );
                          const pct = Number(row.comision_porcentaje ?? 15);
                          const importe = Number(row.precio_cobrado || 0) * Number(row.cantidad || 1);
                          const comisionMonto = importe * (pct / 100);
                          const isDeferred = row.estatus_aprobacion === "Diferido";

                          return (
                            <tr
                              key={row.id}
                              className={isDeferred ? "bg-slate-50 opacity-60" : "hover:bg-slate-50/80"}
                            >
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">
                                  {row.servicios_taller?.nombre || "Servicio"}
                                </div>
                                {row.notas && (
                                  <div className="text-[11px] text-slate-500">{row.notas}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-600">
                                {mech?.nombre || "Por asignar"}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono tabular-nums text-[11px]">
                                {Number(row.horas_labor || 1).toFixed(1)}h
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-[11px] text-slate-600">
                                ${comisionMonto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}{" "}
                                <span className="text-[10px] text-slate-400">({pct}%)</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleServiceApproval(row)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                                    row.estatus_aprobacion === "Diferido"
                                      ? "bg-slate-200 text-slate-600"
                                      : row.estatus_aprobacion === "Pendiente"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {row.estatus_aprobacion || "Aprobado"}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                                ${importe.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  {!isDeferred && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeferService(row)}
                                      title="Enviar a Trabajos Diferidos para próxima visita"
                                      className="px-2 py-1 rounded text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                                    >
                                      Diferir
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveService(row.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 2. REFACCIONES SOBRE PEDIDO / BUYOUTS (CON CALCULADORA DE MARGEN) */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package size={15} className="text-indigo-600" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Refacciones Sobre Pedido / Buyouts ({partsList.length})
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingPart(!isAddingPart)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Calculator size={13} /> + Cotizar Refacción Externa
                  </button>
                </div>

                {isAddingPart && (
                  <div className="p-4 bg-indigo-50/40 border-b border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-950 flex items-center gap-1.5">
                        <Calculator size={14} className="text-indigo-600" />
                        Calculadora de Margen de Refacciones en Vivo
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                        Margen Taller Default: {empresa?.margen_refacciones_default ?? 35}%
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Concepto / Refacción
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Juego Balatas Cerámicas Del."
                          value={partNombre}
                          onChange={(e) => setPartNombre(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2.5 text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          No. Parte (SKU)
                        </label>
                        <input
                          type="text"
                          placeholder="D1521-8840"
                          value={partNumero}
                          onChange={(e) => setPartNumero(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-slate-900 font-mono"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Proveedor
                        </label>
                        <select
                          value={partProveedor}
                          onChange={(e) => setPartProveedor(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-slate-900"
                        >
                          {PROVEEDORES_REFACCIONES.map((prov) => (
                            <option key={prov} value={prov}>
                              {prov}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Cant.
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={partCantidad}
                          onChange={(e) => setPartCantidad(parseInt(e.target.value) || 1)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-center tabular-nums"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Costo Prov. ($)
                        </label>
                        <input
                          type="number"
                          step="10"
                          placeholder="0.00"
                          value={partCostoUnitario}
                          onChange={(e) => setPartCostoUnitario(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-slate-900 font-bold tabular-nums"
                        />
                      </div>
                    </div>

                    {/* Live Calculation Bar */}
                    <div className="bg-white border border-indigo-200 rounded-md p-2.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] font-bold uppercase text-slate-500">
                            Markup (%):
                          </label>
                          <input
                            type="number"
                            step="1"
                            value={partMargen}
                            onChange={(e) => setPartMargen(e.target.value)}
                            className="w-16 h-7 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-300 rounded px-2 text-center tabular-nums"
                          />
                        </div>

                        <div className="text-xs">
                          <span className="text-slate-500">P. Venta Unitario: </span>
                          <strong className="text-slate-900 font-mono tabular-nums">
                            ${calcPrecioUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </strong>
                        </div>

                        <div className="text-xs">
                          <span className="text-slate-500">Subtotal Cliente: </span>
                          <strong className="text-indigo-700 font-mono tabular-nums">
                            ${calcSubtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </strong>
                        </div>

                        <div className="text-xs">
                          <span className="text-slate-500">Utilidad Neta Pieza: </span>
                          <strong className="text-emerald-700 font-mono tabular-nums">
                            +${calcUtilidad.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingPart(false)}
                          className="px-3 h-7 text-xs text-slate-500 hover:text-slate-800"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={!partNombre.trim() || numericCosto <= 0 || addingPartLoading}
                          onClick={handleAddPart}
                          className="px-3.5 h-7 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          {addingPartLoading ? "Agregando..." : "Agregar Refacción"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {partsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No hay refacciones externas (buyouts) en esta orden.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] uppercase font-bold text-slate-500">
                          <th className="py-2 px-3">Refacción / No. Parte</th>
                          <th className="py-2 px-3">Proveedor</th>
                          <th className="py-2 px-3 text-center">Cant</th>
                          <th className="py-2 px-3 text-right">Costo U.</th>
                          <th className="py-2 px-3 text-center">Margen</th>
                          <th className="py-2 px-3 text-right">P. Venta</th>
                          <th className="py-2 px-3 text-right">Subtotal</th>
                          <th className="py-2 px-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {partsList.map((part: any) => {
                          const isDeferred = part.estatus_aprobacion === "Diferido";
                          const utilRow =
                            Number(part.subtotal || 0) -
                            Number(part.costo_unitario || 0) * Number(part.cantidad || 1);
                          return (
                            <tr
                              key={part.id}
                              className={isDeferred ? "bg-slate-50 opacity-60" : "hover:bg-slate-50/80"}
                            >
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">{part.nombre}</div>
                                {part.numero_parte && (
                                  <span className="font-mono text-[10px] text-slate-500">
                                    P/N: {part.numero_parte}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                  {part.proveedor || "Proveedor"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center tabular-nums font-medium">
                                {part.cantidad}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                                ${Number(part.costo_unitario).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold tabular-nums">
                                  +{Number(part.margen_porcentaje).toFixed(0)}% ($
                                  {utilRow.toLocaleString("es-MX", { maximumFractionDigits: 0 })})
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">
                                ${Number(part.precio_unitario).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                                ${Number(part.subtotal).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  {!isDeferred && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeferPart(part)}
                                      className="px-2 py-1 rounded text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                                    >
                                      Diferir
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePart(part.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 3. NEUMÁTICOS DE STOCK */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CircleDot size={15} className="text-slate-700" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Neumáticos de Inventario ({tiresList.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingTire(!isAddingTire)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus size={13} /> Agregar Neumáticos
                  </button>
                </div>

                {isAddingTire && (
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <select
                      value={selectedTireId}
                      onChange={(e) => setSelectedTireId(e.target.value)}
                      className="flex-1 h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-slate-900"
                    >
                      <option value="">Seleccionar medida y modelo en stock...</option>
                      {availableTires.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.marca} {t.modelo_llanta} ({t.ancho}/{t.perfil} R{t.rin}) • Stock:{" "}
                          {t.stock_actual} • ${Number(t.precio_venta).toLocaleString("es-MX")}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={selectedTireQty}
                      onChange={(e) => setSelectedTireQty(parseInt(e.target.value) || 1)}
                      className="w-16 h-8 text-xs bg-white border border-slate-300 rounded-md px-2 text-center font-bold tabular-nums"
                    />
                    <button
                      type="button"
                      disabled={!selectedTireId || addingTireLoading}
                      onClick={handleAddTire}
                      className="px-4 h-8 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {addingTireLoading ? "..." : "Agregar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingTire(false)}
                      className="px-2 h-8 text-xs text-slate-500"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {tiresList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No se han incluido neumáticos del inventario en esta orden.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] uppercase font-bold text-slate-500">
                        <th className="py-2 px-3">Marca / Modelo / Medida</th>
                        <th className="py-2 px-3 text-center">Cant</th>
                        <th className="py-2 px-3 text-right">P. Unitario</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                        <th className="py-2 px-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {tiresList.map((row: any) => {
                        const t = row.inventario_llantas;
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {t?.marca} {t?.modelo_llanta}{" "}
                              <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded ml-1">
                                {t?.ancho}/{t?.perfil} R{t?.rin}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center tabular-nums font-bold">
                              {row.cantidad}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              ${Number(row.precio_unitario).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                              ${Number(row.subtotal).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveTire(row)}
                                className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right 4 Cols: Resumen Financiero y Rentabilidad */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-4 sticky top-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Rentabilidad y Resumen Financiero
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    IVA {empresa?.tasa_iva ?? 16}%
                  </span>
                </div>

                {/* Revenue Breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Mano de Obra ({activeServices.length}):</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      ${subtotalServicios.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Refacciones Sobre Pedido ({activeParts.length}):</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      ${subtotalRefacciones.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Neumáticos de Stock ({activeTires.length}):</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      ${subtotalLlantas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Internal Shop Costs & Gross Margin Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1.5 text-[11px]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Costos Internos de la Orden
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Costo Adquisición Refacciones:</span>
                    <span className="tabular-nums font-mono">
                      -${costoRefacciones.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Costo Adquisición Neumáticos:</span>
                    <span className="tabular-nums font-mono">
                      -${costoLlantas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Comisión Técnico Asignado:</span>
                    <span className="tabular-nums font-mono">
                      -${comisionTecnicoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 mt-1 flex justify-between items-center">
                    <span className="font-bold text-slate-800">Utilidad Bruta Estimada:</span>
                    <div className="text-right">
                      <span className="font-black text-emerald-700 text-xs tabular-nums">
                        ${utilidadBruta.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold tabular-nums">
                        {margenBrutoPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grand Total & Balance */}
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold uppercase text-slate-500">Gran Total</span>
                    <span className="text-xl font-black text-slate-900 tabular-nums">
                      ${granTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Total Pagado / Abonado:</span>
                    <span className="font-bold text-emerald-600 tabular-nums">
                      ${totalPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-md bg-amber-50 border border-amber-200">
                    <span className="text-xs font-bold uppercase text-amber-900">
                      Saldo por Cobrar
                    </span>
                    <span className="text-base font-black text-amber-700 tabular-nums">
                      ${saldoPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="pt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("pagos")}
                    className="w-full py-2 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Banknote size={14} /> Ir a Caja / Registrar Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("impresion")}
                    className="w-full py-2 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Printer size={14} /> Ver Hoja de Recepción Imprimible
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INSPECCIÓN DIGITAL (DVI) Y RECEPCIÓN */}
        {activeTab === "dvi" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Cols: Persistent DVI CRUD */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Inspección Digital Multipunto (DVI Persistente)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Los cambios se reflejan en tiempo real en el Portal del Cliente (`/orden/{orderId.slice(0, 8)}`).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dviItems.length === 0 && (
                      <button
                        type="button"
                        disabled={savingDviLoading}
                        onClick={handleLoadDviTemplate}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                      >
                        <Sparkles size={13} /> Cargar Plantilla Multipunto 6 Puntos
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAddingDvi(!isAddingDvi)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus size={13} /> + Agregar Punto
                    </button>
                  </div>
                </div>

                {isAddingDvi && (
                  <div className="p-4 bg-blue-50/40 border-b border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Categoría
                        </label>
                        <select
                          value={newDviCategoria}
                          onChange={(e) => setNewDviCategoria(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2"
                        >
                          <option value="Frenos">Sistema de Frenos</option>
                          <option value="Suspensión y Dirección">Suspensión y Dirección</option>
                          <option value="Neumáticos">Neumáticos y Alineación</option>
                          <option value="Motor y Fluidos">Motor y Fluidos</option>
                          <option value="Sistema Eléctrico">Sistema Eléctrico</option>
                          <option value="Seguridad y Chasis">Seguridad y Chasis</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Punto de Inspección
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Balatas Delanteras y Discos Ventilados"
                          value={newDviPunto}
                          onChange={(e) => setNewDviPunto(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Severidad Semáforo
                        </label>
                        <select
                          value={newDviSeveridad}
                          onChange={(e) => setNewDviSeveridad(e.target.value as any)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2 font-bold"
                        >
                          <option value="verde">🟢 Verde — En Buen Estado</option>
                          <option value="amarillo">🟡 Amarillo — Precaución / Pronto</option>
                          <option value="rojo">🔴 Rojo — Reparación Urgente</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Costo Estimado Reparación ($)
                        </label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={newDviCosto}
                          onChange={(e) => setNewDviCosto(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2.5 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          URL Evidencia Fotográfica
                        </label>
                        <input
                          type="text"
                          placeholder="https://images.unsplash.com/..."
                          value={newDviFoto}
                          onChange={(e) => setNewDviFoto(e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="Hallazgo u observación técnica..."
                        value={newDviObs}
                        onChange={(e) => setNewDviObs(e.target.value)}
                        className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2.5"
                      />
                      <input
                        type="text"
                        placeholder="Acción o recomendación al cliente..."
                        value={newDviRec}
                        onChange={(e) => setNewDviRec(e.target.value)}
                        className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2.5"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingDvi(false)}
                        className="px-3 h-7 text-xs text-slate-600"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={!newDviPunto.trim() || savingDviLoading}
                        onClick={handleAddDviPoint}
                        className="px-4 h-7 rounded bg-blue-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Guardar Punto DVI
                      </button>
                    </div>
                  </div>
                )}

                {dviItems.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-xs text-slate-500">
                      Esta orden aún no tiene puntos de inspección registrados.
                    </p>
                    <button
                      type="button"
                      onClick={handleLoadDviTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white text-xs font-bold cursor-pointer"
                    >
                      <Sparkles size={14} /> Inicializar Check-list Multipunto Estándar (6 Puntos)
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {dviItems.map((item) => (
                      <div key={item.id} className="p-4 space-y-2.5 hover:bg-slate-50/50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              {item.categoria}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900">
                              {item.punto_inspeccion}
                            </h4>
                          </div>

                          {/* Traffic-Light Buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateDviItem(item.id, { severidad: "verde" })}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                                item.severidad === "verde"
                                  ? "bg-emerald-600 text-white shadow-2xs"
                                  : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                              }`}
                            >
                              Bien
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateDviItem(item.id, { severidad: "amarillo" })
                              }
                              className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                                item.severidad === "amarillo"
                                  ? "bg-amber-500 text-white shadow-2xs"
                                  : "bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                              }`}
                            >
                              Precaución
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateDviItem(item.id, { severidad: "rojo" })}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                                item.severidad === "rojo"
                                  ? "bg-red-600 text-white shadow-2xs"
                                  : "bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-700"
                              }`}
                            >
                              Urgente
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDviItem(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 ml-1 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <input
                            type="text"
                            defaultValue={item.observaciones || ""}
                            onBlur={(e) =>
                              handleUpdateDviItem(item.id, { observaciones: e.target.value })
                            }
                            placeholder="Observaciones del técnico..."
                            className="sm:col-span-5 h-7 text-[11px] bg-white border border-slate-200 rounded px-2 text-slate-700"
                          />
                          <input
                            type="text"
                            defaultValue={item.recomendacion || ""}
                            onBlur={(e) =>
                              handleUpdateDviItem(item.id, { recomendacion: e.target.value })
                            }
                            placeholder="Recomendación para el cliente..."
                            className="sm:col-span-5 h-7 text-[11px] bg-white border border-slate-200 rounded px-2 text-slate-700"
                          />
                          <input
                            type="number"
                            defaultValue={item.costo_estimado || ""}
                            onBlur={(e) =>
                              handleUpdateDviItem(item.id, {
                                costo_estimado: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder="$ Est."
                            className="sm:col-span-2 h-7 text-[11px] bg-white border border-slate-200 rounded px-2 text-right font-mono tabular-nums"
                          />
                        </div>

                        {(item.severidad === "amarillo" || item.severidad === "rojo") && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-2">
                              {item.foto_url ? (
                                <a
                                  href={item.foto_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline"
                                >
                                  <Camera size={12} /> Ver Foto Evidencia Adjunta
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateDviItem(item.id, {
                                      foto_url:
                                        "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80",
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-blue-600 cursor-pointer"
                                >
                                  <Camera size={12} /> + Adjuntar Foto Evidencia
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSendDviToDeferred(item)}
                              disabled={item.estatus_cliente === "Diferido"}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 disabled:opacity-50 cursor-pointer"
                            >
                              <History size={11} />
                              {item.estatus_cliente === "Diferido"
                                ? "Enviado a Trabajos Diferidos ✓"
                                : "Enviar a Trabajos Diferidos"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Reception Checklist & Technical Diagnosis */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Datos de Recepción y Diagnóstico
                  </h3>
                  {receptionSavedToast && (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check size={13} /> Guardado
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Kilometraje (km)
                    </label>
                    <input
                      type="number"
                      value={recKilometraje}
                      onChange={(e) => setRecKilometraje(e.target.value)}
                      className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2 font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Nivel Gasolina
                    </label>
                    <select
                      value={recGasolina}
                      onChange={(e) => setRecGasolina(e.target.value)}
                      className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2 font-semibold"
                    >
                      <option value="Vacío">Vacío</option>
                      <option value="1/4">1/4</option>
                      <option value="1/2">1/2</option>
                      <option value="3/4">3/4</option>
                      <option value="Lleno">Lleno</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Bahía / Rampa
                    </label>
                    <select
                      value={recBahia}
                      onChange={(e) => setRecBahia(e.target.value)}
                      className="w-full h-8 text-xs bg-white border border-slate-300 rounded px-2"
                    >
                      <option value="">Sin asignar</option>
                      {BAHIAS_TALLER.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">
                    Inventario de Recepción (Check-in)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                    {CHECKLIST_ITEMS.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={!!recChecklist[item.key]}
                          onChange={(e) =>
                            setRecChecklist((prev) => ({
                              ...prev,
                              [item.key]: e.target.checked,
                            }))
                          }
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Falla o Solicitud Reportada por el Cliente
                  </label>
                  <textarea
                    rows={3}
                    value={recProblema}
                    onChange={(e) => setRecProblema(e.target.value)}
                    placeholder="Describe el síntoma reportado al ingreso..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-md p-2.5 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Diagnóstico Técnico del Especialista
                  </label>
                  <textarea
                    rows={3}
                    value={recDiagnostico}
                    onChange={(e) => setRecDiagnostico(e.target.value)}
                    placeholder="Conclusión técnica tras revisión en rampa..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-md p-2.5 text-slate-900"
                  />
                </div>

                <button
                  type="button"
                  disabled={savingReception}
                  onClick={handleSaveReception}
                  className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Save size={14} />
                  {savingReception ? "Guardando..." : "Guardar Recepción y Diagnóstico"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PAGOS Y COBRANZA */}
        {activeTab === "pagos" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Historial de Pagos y Abonos de la Orden ({pagosList.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPayment(true);
                      if (saldoPendiente > 0) setPaymentAmount(String(saldoPendiente));
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <Plus size={13} /> Registrar Cobro
                  </button>
                </div>

                {pagosList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No se han registrado pagos para esta orden todavía.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] uppercase font-bold text-slate-500">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Método / Proveedor</th>
                        <th className="py-2.5 px-3">Referencia</th>
                        <th className="py-2.5 px-3 text-center">Estatus</th>
                        <th className="py-2.5 px-3 text-right">Monto</th>
                        <th className="py-2.5 px-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {pagosList.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 tabular-nums text-slate-600">
                            {new Date(p.fecha_pago).toLocaleString("es-MX", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{p.proveedor_pago}</div>
                            {p.metodo_detalle && (
                              <div className="text-[10px] text-slate-500">{p.metodo_detalle}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            {p.referencia || p.external_transaction_id || "CAJA-MOSTRADOR"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                p.estatus === "Aprobado"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {p.estatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                            ${Number(p.monto_total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemovePayment(p.id)}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Terminal / Payment Registration Box */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-4">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Terminal de Cobro en Caja
                  </h3>
                  {saldoPendiente > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(saldoPendiente))}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Cobrar Saldo Total (${saldoPendiente.toLocaleString("es-MX")})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Monto a Cobrar ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full h-9 text-sm font-black bg-white border border-slate-300 rounded-md px-3 text-slate-900 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Método / Pasarela
                    </label>
                    <select
                      value={paymentProvider}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPaymentProvider(val);
                        if (val === "Efectivo") setPaymentMetodoDetalle("Efectivo en Caja");
                        else if (val === "Transferencia")
                          setPaymentMetodoDetalle("Transferencia SPEI");
                        else if (val === "Mercado Pago")
                          setPaymentMetodoDetalle("Terminal Point Smart TPV");
                        else if (val === "Stripe")
                          setPaymentMetodoDetalle("Tarjeta Crédito / Débito");
                      }}
                      className="w-full h-9 text-xs font-bold bg-white border border-slate-300 rounded-md px-2.5 text-slate-900"
                    >
                      <option value="Efectivo">💵 Efectivo en Caja</option>
                      <option value="Transferencia">🏦 Transferencia SPEI</option>
                      <option value="Mercado Pago">💳 Mercado Pago (Point / Link)</option>
                      <option value="Stripe">💳 Tarjeta Bancaria (Stripe)</option>
                      <option value="KueskiPay">📱 Kueski Pay (BNPL)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Detalle de Instrumento
                    </label>
                    <input
                      type="text"
                      value={paymentMetodoDetalle}
                      onChange={(e) => setPaymentMetodoDetalle(e.target.value)}
                      className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Referencia / Folio Voucher
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. SPEI-99412 o Aut TPV"
                      value={paymentReferencia}
                      onChange={(e) => setPaymentReferencia(e.target.value)}
                      className="w-full h-8 text-xs bg-white border border-slate-300 rounded-md px-2.5 font-mono text-slate-800"
                    />
                  </div>
                </div>

                {["Mercado Pago", "KueskiPay", "Atrato"].includes(paymentProvider) && (
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentMode("directo")}
                      className={`flex-1 py-1.5 rounded font-bold text-[11px] cursor-pointer ${
                        paymentMode === "directo"
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Terminal Física TPV (Aprobado)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode("link")}
                      className={`flex-1 py-1.5 rounded font-bold text-[11px] cursor-pointer ${
                        paymentMode === "link"
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Generar Link de Pago Digital
                    </button>
                  </div>
                )}

                {paymentStatusMessage && (
                  <div className="text-xs text-blue-700 bg-blue-50 p-2.5 rounded border border-blue-200">
                    {paymentStatusMessage}
                  </div>
                )}

                <button
                  type="button"
                  disabled={addingPaymentLoading || !paymentAmount}
                  onClick={handleAddPayment}
                  className="w-full py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  {addingPaymentLoading ? "Procesando..." : "Confirmar y Aplicar Pago"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: HOJA DE RECEPCIÓN / IMPRESIÓN */}
        {activeTab === "impresion" && (
          <OrderPrintSheet order={order} mechanicName={assignedMechanic?.nombre} />
        )}
      </div>
    </div>
  );
}
