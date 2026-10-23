"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/context/TenantContext";
import { Modal } from "../../../../components/ui/Modal";
import { VehicleForm } from "../../../../components/clientes/VehicleForm";
import { ClientForm } from "../../../../components/clientes/ClientForm";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  Car,
  ClipboardList,
  Wallet,
  Plus,
  X,
  AlertTriangle,
  MessageCircle,
  Wrench,
  ExternalLink,
  CheckCircle2,
  Disc,
  Edit3,
  Building2,
  Clock,
  TrendingUp,
} from "lucide-react";

interface Vehicle {
  id: string;
  marca: string;
  modelo: string;
  placas: string | null;
  anio: number;
  vin?: string | null;
  color?: string | null;
  kilometraje_actual?: number | null;
  medida_oem?: string | null;
  presion_delantera_psi?: number | null;
  presion_trasera_psi?: number | null;
}

interface DeferredWork {
  id: string;
  vehiculo_id: string;
  cliente_id: string | null;
  orden_origen_id: string | null;
  concepto: string;
  categoria: string | null;
  severidad: "amarillo" | "rojo" | string;
  costo_estimado: number;
  notas: string | null;
  fecha_recordatorio: string | null;
  resuelto: boolean;
  created_at: string;
}

interface ServiceOrder {
  id: string;
  folio?: number | null;
  estado: string;
  sub_estado?: string | null;
  fecha_ingreso: string;
  vehiculo_id: string;
  estatus_pago: string;
  problema_reportado?: string | null;
  vehiculo?: Vehicle;
  orden_servicio_servicios?: {
    precio_cobrado: number;
    estatus_aprobacion?: string | null;
    servicios_taller?: { nombre: string } | null;
  }[];
  orden_servicio_refacciones?: {
    descripcion?: string;
    subtotal: number;
    estatus_aprobacion?: string | null;
  }[];
  cotizaciones?: {
    id: string;
    total: number;
    estado?: string | null;
    detalles_cotizacion?: {
      subtotal: number;
      estatus_aprobacion?: string | null;
    }[];
  }[];
  pagos_orden?: {
    monto_total: number;
    estatus: string;
    deleted_at: string | null;
  }[];
}

interface ClientProfile {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  empresa?: string | null;
  rfc?: string | null;
  fuente_adquisicion?: string | null;
  notas_internas?: string | null;
  tags: string[];
  vehiculos: Vehicle[];
  fecha_registro?: string | null;
  creado_en?: string | null;
}

function cleanWhatsAppPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("52") ? digits : `52${digits}`;
}

function computeOrderFinancials(order: ServiceOrder, tasaIva = 16) {
  const validPayments = (order.pagos_orden || []).filter(
    (p) => p.estatus === "Aprobado" && !p.deleted_at
  );
  const paidAmount = validPayments.reduce(
    (acc, p) => acc + Number(p.monto_total || 0),
    0
  );

  // Sum of labor + buyouts + tires (IVA Incluido, excluding Diferido/Rechazado)
  const laborSubtotal = (order.orden_servicio_servicios || [])
    .filter((s) => s.estatus_aprobacion !== "Rechazado" && s.estatus_aprobacion !== "Diferido")
    .reduce((acc, s) => acc + Number(s.precio_cobrado || 0), 0);

  const partsSubtotal = (order.orden_servicio_refacciones || [])
    .filter((r) => r.estatus_aprobacion !== "Rechazado" && r.estatus_aprobacion !== "Diferido")
    .reduce((acc, r) => acc + Number(r.subtotal || 0), 0);

  let tiresSubtotal = 0;
  let quoteTotalFallback = 0;
  const cotList = Array.isArray(order.cotizaciones)
    ? order.cotizaciones
    : order.cotizaciones
    ? [order.cotizaciones]
    : [];
  cotList.forEach((c: any) => {
    if (c.detalles_cotizacion && c.detalles_cotizacion.length > 0) {
      tiresSubtotal += c.detalles_cotizacion
        .filter((d: any) => d.estatus_aprobacion !== "Rechazado" && d.estatus_aprobacion !== "Diferido")
        .reduce((acc: number, d: any) => acc + Number(d.subtotal || 0), 0);
    } else if (Number(c.total || 0) > quoteTotalFallback) {
      quoteTotalFallback = Number(c.total || 0);
    }
  });

  const combinedSubtotal = laborSubtotal + partsSubtotal + tiresSubtotal;
  const computedTotal =
    combinedSubtotal > 0
      ? combinedSubtotal
      : quoteTotalFallback;

  const orderTotal = Math.max(computedTotal, paidAmount);
  const effectivePaid =
    paidAmount > 0
      ? paidAmount
      : order.estatus_pago === "Pagado"
      ? orderTotal
      : 0;
  const balanceDue =
    order.estado === "Cancelado"
      ? 0
      : Math.max(0, orderTotal - effectivePaid);

  return {
    total: orderTotal,
    paid: effectivePaid,
    balance: balanceDue,
  };
}

function ClientProfileContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { empresa } = useTenant();
  const clientId = params.id as string;
  const queryVehiculoId = searchParams.get("vehiculoId");

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [deferredWorks, setDeferredWorks] = useState<DeferredWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string | null>(
    queryVehiculoId
  );

  // Tag state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");

  // Modals
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isDeferredModalOpen, setIsDeferredModalOpen] = useState(false);

  // Deferred form state
  const [deferredForm, setDeferredForm] = useState({
    vehiculo_id: "",
    concepto: "",
    categoria: "Frenos",
    severidad: "amarillo",
    costo_estimado: "",
    fecha_recordatorio: new Date(Date.now() + 15 * 86400000)
      .toISOString()
      .slice(0, 10),
    notas: "",
  });
  const [savingDeferred, setSavingDeferred] = useState(false);

  useEffect(() => {
    setSelectedVehicleFilter(queryVehiculoId);
  }, [queryVehiculoId]);

  const loadProfile = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const supabase = createClient();

      const { data: clientData, error: clientErr } = await supabase
        .from("clientes")
        .select(
          `
          id, nombre, telefono, correo, empresa, rfc, fuente_adquisicion, notas_internas, tags, fecha_registro,
          vehiculos (
            id, marca, modelo, placas, anio, vin, color, kilometraje_actual, medida_oem, presion_delantera_psi, presion_trasera_psi
          )
        `
        )
        .eq("id", clientId)
        .single();

      if (clientErr) throw clientErr;
      const typedClient = {
        ...clientData,
        tags: Array.isArray(clientData.tags) ? clientData.tags : [],
        vehiculos: clientData.vehiculos || [],
      } as ClientProfile;
      setClient(typedClient);

      const vehicleIds = typedClient.vehiculos.map((v) => v.id);

      if (vehicleIds.length > 0) {
        const [{ data: ordersData }, { data: deferredData }] = await Promise.all([
          supabase
            .from("ordenes_servicio")
            .select(
              `
              id, folio, estado, sub_estado, fecha_ingreso, estatus_pago, vehiculo_id, problema_reportado,
              orden_servicio_servicios (precio_cobrado, estatus_aprobacion, servicios_taller(nombre)),
              orden_servicio_refacciones (nombre, subtotal, estatus_aprobacion),
              cotizaciones (id, total, estatus, detalles_cotizacion(subtotal, estatus_aprobacion)),
              pagos_orden (monto_total, estatus, deleted_at)
            `
            )
            .in("vehiculo_id", vehicleIds)
            .order("fecha_ingreso", { ascending: false }),
          supabase
            .from("trabajos_diferidos")
            .select("*")
            .in("vehiculo_id", vehicleIds)
            .eq("resuelto", false)
            .order("created_at", { ascending: false }),
        ]);

        if (ordersData) {
          const mappedOrders: ServiceOrder[] = ordersData.map((o: any) => ({
            ...o,
            vehiculo: typedClient.vehiculos.find((v) => v.id === o.vehiculo_id),
          }));
          setOrders(mappedOrders);
        }

        if (deferredData) {
          setDeferredWorks(deferredData as DeferredWork[]);
        }
      } else {
        setOrders([]);
        setDeferredWorks([]);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const tasaIva = empresa?.tasa_iva ?? 16;

  // Real financial metrics
  const financials = orders.reduce(
    (acc, order) => {
      const { paid, balance } = computeOrderFinancials(order, tasaIva);
      return {
        ltv: acc.ltv + paid,
        porCobrar: acc.porCobrar + balance,
      };
    },
    { ltv: 0, porCobrar: 0 }
  );

  const potencialDiferidos = deferredWorks.reduce(
    (acc, d) => acc + Number(d.costo_estimado || 0),
    0
  );

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim() || !client) return;

    const updatedTags = [...(client.tags || []), newTag.trim().toLowerCase()];
    setClient({ ...client, tags: updatedTags });
    setNewTag("");
    setIsAddingTag(false);

    const supabase = createClient();
    await supabase.from("clientes").update({ tags: updatedTags }).eq("id", client.id);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!client) return;
    const updatedTags = (client.tags || []).filter((t) => t !== tagToRemove);
    setClient({ ...client, tags: updatedTags });
    const supabase = createClient();
    await supabase.from("clientes").update({ tags: updatedTags }).eq("id", client.id);
  };

  const handleResolveDeferred = async (deferredId: string) => {
    setDeferredWorks((prev) => prev.filter((d) => d.id !== deferredId));
    const supabase = createClient();
    await supabase
      .from("trabajos_diferidos")
      .update({ resuelto: true })
      .eq("id", deferredId);
  };

  const handleCreateDeferred = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !deferredForm.vehiculo_id || !deferredForm.concepto.trim()) return;
    setSavingDeferred(true);
    const supabase = createClient();
    const { error } = await supabase.from("trabajos_diferidos").insert({
      cliente_id: client.id,
      vehiculo_id: deferredForm.vehiculo_id,
      concepto: deferredForm.concepto.trim(),
      categoria: deferredForm.categoria,
      severidad: deferredForm.severidad,
      costo_estimado: parseFloat(deferredForm.costo_estimado) || 0,
      fecha_recordatorio: deferredForm.fecha_recordatorio || null,
      notas: deferredForm.notas.trim() || null,
      resuelto: false,
    });
    setSavingDeferred(false);
    if (!error) {
      setIsDeferredModalOpen(false);
      setDeferredForm((prev) => ({
        ...prev,
        concepto: "",
        costo_estimado: "",
        notas: "",
      }));
      loadProfile();
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Cliente no encontrado.</p>
        <button
          onClick={() => router.push("/clientes")}
          className="text-blue-600 hover:underline text-sm font-semibold"
        >
          Volver al directorio
        </button>
      </div>
    );
  }

  const waPhone = cleanWhatsAppPhone(client.telefono);
  const filteredDeferred = selectedVehicleFilter
    ? deferredWorks.filter((d) => d.vehiculo_id === selectedVehicleFilter)
    : deferredWorks;
  const filteredOrders = selectedVehicleFilter
    ? orders.filter((o) => o.vehiculo_id === selectedVehicleFilter)
    : orders;

  return (
    <div className="h-full flex flex-col relative max-w-7xl mx-auto space-y-5 pb-8">
      {/* Top Bar & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <button
            onClick={() => router.push("/clientes")}
            className="p-2 bg-white border border-slate-200 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            title="Volver al Directorio"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {client.nombre}
              </h1>
              {client.empresa && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs font-bold">
                  <Building2 size={12} />
                  {client.empresa}
                </span>
              )}
              {client.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="group bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="opacity-60 hover:opacity-100 hover:text-red-600 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              {isAddingTag ? (
                <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    autoFocus
                    placeholder="Etiqueta..."
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-300 focus:outline-none bg-white w-24"
                  />
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingTag(true)}
                  className="bg-white text-slate-500 border border-dashed border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 hover:text-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={10} /> Etiqueta
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Expediente Clínico de Cliente, Flotilla y Trabajos Diferidos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsEditClientOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Edit3 size={13} /> Editar Cliente
          </button>
          <button
            onClick={() => {
              setEditingVehicle(null);
              setIsVehicleModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus size={13} /> Agregar Vehículo
          </button>
          <button
            onClick={() => {
              const targetVeh =
                selectedVehicleFilter || client.vehiculos[0]?.id || "";
              router.push(
                `/tablero?nuevaOrden=1&clienteId=${client.id}${
                  targetVeh ? `&vehiculoId=${targetVeh}` : ""
                }`
              );
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Wrench size={13} /> + Abrir Orden en Taller
          </button>
        </div>
      </div>

      {/* Top Row: Contact Card + 3 Real Financial KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Contact Info */}
        <div className="panel-card p-4 bg-white lg:col-span-1 flex flex-col justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User size={13} className="text-blue-600" /> Datos de Contacto y Fiscal
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-mono font-semibold text-slate-800">
                  <Phone size={13} className="text-slate-400" />
                  {client.telefono || "Sin teléfono"}
                </span>
                {waPhone && (
                  <a
                    href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                      `Hola ${client.nombre}, te escribimos de ${
                        empresa?.nombre_comercial || "tu Centro Automotriz"
                      }.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <MessageCircle size={11} /> WhatsApp
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <Mail size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{client.correo || "Sin correo registrado"}</span>
              </div>

              {client.rfc && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                    RFC
                  </span>
                  <span className="font-mono font-semibold text-slate-800">
                    {client.rfc}
                  </span>
                </div>
              )}

              {client.notas_internas && (
                <div className="mt-2 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-md text-[11px] text-amber-900">
                  <span className="font-bold block mb-0.5">Notas de Servicio:</span>
                  {client.notas_internas}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              Alta:{" "}
              {client.fecha_registro
                ? new Date(client.fecha_registro).toLocaleDateString("es-MX")
                : "Registrado"}
            </span>
            {client.fuente_adquisicion && (
              <span className="font-semibold text-slate-500">
                Origen: {client.fuente_adquisicion}
              </span>
            )}
          </div>
        </div>

        {/* KPI 1: LTV Pagado */}
        <div className="panel-card p-4 bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              LTV (Total Pagado)
            </span>
            <Wallet size={15} className="text-emerald-600" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black font-mono text-slate-900">
              ${financials.ltv.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">
            {orders.length} órdenes en historial clínico
          </span>
        </div>

        {/* KPI 2: Saldo Por Cobrar */}
        <div className="panel-card p-4 bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Saldo Por Cobrar
            </span>
            <Clock size={15} className="text-blue-600" />
          </div>
          <div className="my-2">
            <span
              className={`text-2xl font-black font-mono ${
                financials.porCobrar > 0 ? "text-amber-700" : "text-slate-900"
              }`}
            >
              $
              {financials.porCobrar.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            En órdenes activas o pendientes de liquidar
          </span>
        </div>

        {/* KPI 3: Potencial en Trabajos Diferidos */}
        <div className="panel-card p-4 bg-amber-50/40 border-amber-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              Potencial en Diferidos
            </span>
            <TrendingUp size={15} className="text-amber-600" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black font-mono text-amber-800">
              $
              {potencialDiferidos.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <span className="text-[11px] text-amber-800 font-semibold">
            {deferredWorks.length} reparaciones recomendadas sin realizar
          </span>
        </div>
      </div>

      {/* Flotilla / Vehículos Section */}
      <div className="panel-card p-4 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Car size={16} className="text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Unidades Registradas ({client.vehiculos.length})
            </h2>
            {selectedVehicleFilter && (
              <button
                onClick={() => setSelectedVehicleFilter(null)}
                className="text-[11px] font-semibold text-blue-600 hover:underline ml-2 cursor-pointer"
              >
                Mostrar todas las unidades ({client.vehiculos.length})
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setEditingVehicle(null);
              setIsVehicleModalOpen(true);
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            <Plus size={14} /> Añadir Vehículo a la Flotilla
          </button>
        </div>

        {client.vehiculos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {client.vehiculos.map((v) => {
              const isSelected = selectedVehicleFilter === v.id;
              const vehDeferred = deferredWorks.filter((d) => d.vehiculo_id === v.id);
              const km = v.kilometraje_actual ?? 0;

              return (
                <div
                  key={v.id}
                  onClick={() =>
                    setSelectedVehicleFilter(isSelected ? null : v.id)
                  }
                  className={`rounded-lg border p-3.5 transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/40 border-blue-500 ring-1 ring-blue-500"
                      : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-bold text-slate-900 block">
                          {v.marca} {v.modelo}{" "}
                          <span className="font-mono text-slate-500 font-semibold">
                            {v.anio}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          VIN: {v.vin || "NO REGISTRADO"}
                        </span>
                      </div>
                      <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-800 shrink-0">
                        {v.placas || "S/PLACAS"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-200/70 text-[11px]">
                      <div>
                        <span className="text-slate-400 uppercase block text-[9px] font-bold">
                          Odómetro
                        </span>
                        <span className="font-mono font-bold text-slate-700">
                          {Number(km).toLocaleString("es-MX")} km
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 uppercase block text-[9px] font-bold">
                          Color
                        </span>
                        <span className="font-semibold text-slate-700 capitalize">
                          {v.color || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 uppercase block text-[9px] font-bold">
                          Presión PSI
                        </span>
                        <span className="font-mono font-bold text-slate-700">
                          {v.presion_delantera_psi || 33}/{v.presion_trasera_psi || 33}{" "}
                          PSI
                        </span>
                      </div>
                    </div>

                    {/* Medida OEM con Deep-Link a Inventario */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-slate-200/80">
                      <span className="text-[11px] font-mono text-slate-700 flex items-center gap-1.5">
                        <Disc size={12} className="text-blue-600 shrink-0" />
                        OEM:{" "}
                        <strong>{v.medida_oem || "Sin medida"}</strong>
                      </span>
                      {v.medida_oem && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/inventario?q=${encodeURIComponent(v.medida_oem!)}`
                            );
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          Ver llantas {v.medida_oem} ↗
                        </button>
                      )}
                    </div>

                    {vehDeferred.length > 0 && (
                      <div className="mt-2 px-2.5 py-1 rounded bg-amber-100/80 border border-amber-200 text-[11px] font-bold text-amber-900 flex items-center justify-between">
                        <span>⚠️ {vehDeferred.length} trabajo(s) diferido(s)</span>
                        <span className="font-mono">
                          $
                          {vehDeferred
                            .reduce((s, d) => s + Number(d.costo_estimado || 0), 0)
                            .toLocaleString("es-MX")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingVehicle(v);
                        setIsVehicleModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 size={11} /> Editar Auto
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/tablero?nuevaOrden=1&clienteId=${client.id}&vehiculoId=${v.id}`
                        );
                      }}
                      className="px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Wrench size={11} /> + Abrir Orden en Taller
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs">
            Este cliente aún no tiene unidades registradas.
          </div>
        )}
      </div>

      {/* Trabajos Diferidos y Recomendaciones Pendientes */}
      <div className="panel-card p-4 bg-white border-l-4 border-l-amber-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-slate-100">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600" />
              Trabajos Diferidos y Recomendaciones Pendientes ({filteredDeferred.length})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hallazgos detectados en inspecciones previas pendientes de autorización por el cliente.
            </p>
          </div>
          {client.vehiculos.length > 0 && (
            <button
              onClick={() => {
                setDeferredForm((prev) => ({
                  ...prev,
                  vehiculo_id:
                    selectedVehicleFilter || client.vehiculos[0]?.id || "",
                }));
                setIsDeferredModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <Plus size={13} /> + Registrar Trabajo Diferido
            </button>
          )}
        </div>

        {filteredDeferred.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredDeferred.map((d) => {
              const veh = client.vehiculos.find((v) => v.id === d.vehiculo_id);
              const isUrgent = d.severidad === "rojo";
              const reminderMsg = `Hola ${client.nombre}, te escribimos de ${
                empresa?.nombre_comercial || "Torque & Ruta"
              }. En la última revisión de tu ${
                veh ? `${veh.marca} ${veh.modelo} (${veh.placas || "S/P"})` : "vehículo"
              } quedó pendiente: *${d.concepto}* ( inversión estimada $${Number(
                d.costo_estimado || 0
              ).toLocaleString(
                "es-MX"
              )} ). ¿Deseas que agendemos espacio en taller esta semana?`;

              return (
                <div
                  key={d.id}
                  className={`rounded-lg border p-3.5 flex flex-col justify-between gap-3 ${
                    isUrgent
                      ? "bg-red-50/40 border-red-200"
                      : "bg-amber-50/40 border-amber-200"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isUrgent
                              ? "bg-red-600 text-white"
                              : "bg-amber-500 text-white"
                          }`}
                        >
                          {isUrgent ? "Urgente / Seguridad" : "Precaución"}
                        </span>
                        {d.categoria && (
                          <span className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            {d.categoria}
                          </span>
                        )}
                        {veh && (
                          <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {veh.marca} {veh.modelo} • {veh.placas || "S/P"}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-sm font-black text-slate-900 shrink-0">
                        $
                        {Number(d.costo_estimado || 0).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-slate-900 mt-2">
                      {d.concepto}
                    </p>
                    {d.notas && (
                      <p className="text-xs text-slate-600 mt-1">{d.notas}</p>
                    )}
                    {d.fecha_recordatorio && (
                      <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                        Recordatorio sugerido:{" "}
                        <span className="font-mono font-bold text-slate-700">
                          {new Date(d.fecha_recordatorio).toLocaleDateString("es-MX")}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200/70">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {waPhone && (
                        <a
                          href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                            reminderMsg
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
                        >
                          <MessageCircle size={11} /> Recordar por WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/tablero?nuevaOrden=1&clienteId=${client.id}&vehiculoId=${d.vehiculo_id}&diferidoId=${d.id}`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <Wrench size={11} /> Programar Orden Ahora
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleResolveDeferred(d.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <CheckCircle2 size={11} className="text-emerald-600" /> Marcar
                      Resuelto
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-5 text-center text-slate-500 text-xs">
            No hay trabajos diferidos pendientes para este cliente.
          </div>
        )}
      </div>

      {/* Historial de Órdenes de Servicio Table */}
      <div className="panel-card bg-white overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ClipboardList size={15} className="text-blue-600" /> Historial Clínico de
            Órdenes de Servicio ({filteredOrders.length})
          </h3>
        </div>

        <div className="overflow-x-auto dense-scrollbar">
          {filteredOrders.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Folio
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Vehículo
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Falla Reportada / Servicios
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Estado Operativo
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Pago
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">
                    Total Real
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const { total } = computeOrderFinancials(order, tasaIva);

                  let statusBadge = "bg-slate-100 text-slate-700 border-slate-200";
                  if (order.estado === "Entregado")
                    statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  if (order.estado === "En Progreso")
                    statusBadge = "bg-blue-50 text-blue-700 border-blue-200";
                  if (order.estado === "Listo")
                    statusBadge = "bg-purple-50 text-purple-700 border-purple-200";
                  if (order.estado === "Cancelado")
                    statusBadge = "bg-red-50 text-red-700 border-red-200";

                  let paymentBadge = "bg-slate-100 text-slate-600";
                  if (order.estatus_pago === "Pagado")
                    paymentBadge = "bg-emerald-100 text-emerald-800";
                  if (order.estatus_pago === "Parcial")
                    paymentBadge = "bg-amber-100 text-amber-800";
                  if (order.estatus_pago === "Pendiente")
                    paymentBadge = "bg-red-100 text-red-700";

                  const serviceNames = (order.orden_servicio_servicios || [])
                    .map((s) => s.servicios_taller?.nombre)
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">
                        #{order.folio || order.id.slice(0, 5).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">
                        {new Date(order.fecha_ingreso).toLocaleDateString("es-MX")}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-800">
                        {order.vehiculo?.marca} {order.vehiculo?.modelo}
                        {order.vehiculo?.placas && (
                          <span className="ml-1.5 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {order.vehiculo.placas}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">
                        <div className="font-semibold text-slate-800 truncate">
                          {order.problema_reportado || "Servicio General"}
                        </div>
                        {serviceNames && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {serviceNames}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${statusBadge}`}
                        >
                          {order.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${paymentBadge}`}
                        >
                          {order.estatus_pago}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-bold text-slate-900 text-right">
                        ${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => router.push(`/tablero?ordenId=${order.id}`)}
                            className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Abrir en Tablero →
                          </button>
                          <button
                            onClick={() => router.push(`/orden/${order.id}`)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Abrir Portal Digital del Cliente"
                          >
                            Portal Cliente <ExternalLink size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center flex flex-col items-center">
              <ClipboardList size={28} className="text-slate-300 mb-2" />
              <p className="text-xs font-medium text-slate-500">
                No hay órdenes de servicio registradas para este filtro.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Edit Client */}
      <Modal
        isOpen={isEditClientOpen}
        onClose={() => setIsEditClientOpen(false)}
        title="Editar Expediente del Cliente"
        description="Modifica los datos de contacto, RFC, flotilla o notas."
      >
        <ClientForm
          initialData={{
            id: client.id,
            nombre: client.nombre,
            telefono: client.telefono,
            correo: client.correo,
            empresa: client.empresa,
            rfc: client.rfc,
            fuente_adquisicion: client.fuente_adquisicion,
            notas_internas: client.notas_internas,
            tags: client.tags,
          }}
          onSuccess={() => {
            setIsEditClientOpen(false);
            loadProfile();
          }}
          onCancel={() => setIsEditClientOpen(false)}
        />
      </Modal>

      {/* Modal: Add/Edit Vehicle */}
      <Modal
        isOpen={isVehicleModalOpen}
        onClose={() => {
          setIsVehicleModalOpen(false);
          setEditingVehicle(null);
        }}
        title={editingVehicle ? "Editar Vehículo" : "Registrar Nuevo Vehículo"}
        description="Especificaciones técnicas, medida OEM de llantas y odómetro."
      >
        <VehicleForm
          clientId={client.id}
          initialData={editingVehicle}
          onSuccess={() => {
            setIsVehicleModalOpen(false);
            setEditingVehicle(null);
            loadProfile();
          }}
          onCancel={() => {
            setIsVehicleModalOpen(false);
            setEditingVehicle(null);
          }}
        />
      </Modal>

      {/* Modal: Registrar Trabajo Diferido */}
      <Modal
        isOpen={isDeferredModalOpen}
        onClose={() => setIsDeferredModalOpen(false)}
        title="Registrar Trabajo Diferido / Recomendación"
        description="Guarda una reparación pendiente para dar seguimiento comercial por WhatsApp."
      >
        <form onSubmit={handleCreateDeferred} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Vehículo *
              </label>
              <select
                required
                value={deferredForm.vehiculo_id}
                onChange={(e) =>
                  setDeferredForm((prev) => ({
                    ...prev,
                    vehiculo_id: e.target.value,
                  }))
                }
                className="border border-slate-200 rounded-md bg-white text-sm px-3 py-2 w-full"
              >
                {client.vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} ({v.placas || "S/P"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Categoría Técnica
              </label>
              <select
                value={deferredForm.categoria}
                onChange={(e) =>
                  setDeferredForm((prev) => ({
                    ...prev,
                    categoria: e.target.value,
                  }))
                }
                className="border border-slate-200 rounded-md bg-white text-sm px-3 py-2 w-full"
              >
                <option value="Frenos">Frenos</option>
                <option value="Suspensión">Suspensión y Dirección</option>
                <option value="Llantas">Llantas y Alineación</option>
                <option value="Mantenimiento">Afinación / Mantenimiento</option>
                <option value="Motor">Motor / Enfriamiento</option>
                <option value="Eléctrico">Batería y Eléctrico</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Concepto / Reparación Recomendada *
            </label>
            <input
              required
              value={deferredForm.concepto}
              onChange={(e) =>
                setDeferredForm((prev) => ({ ...prev, concepto: e.target.value }))
              }
              placeholder="Ej. Reemplazo de amortiguadores delanteros y bases"
              className="border border-slate-200 rounded-md bg-white text-sm px-3 py-2 w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Nivel de Severidad
              </label>
              <select
                value={deferredForm.severidad}
                onChange={(e) =>
                  setDeferredForm((prev) => ({
                    ...prev,
                    severidad: e.target.value,
                  }))
                }
                className="border border-slate-200 rounded-md bg-white text-sm px-3 py-2 w-full"
              >
                <option value="rojo">Rojo (Urgente / Seguridad)</option>
                <option value="amarillo">Amarillo (Programar Pronto)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Costo Estimado ($) *
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={deferredForm.costo_estimado}
                onChange={(e) =>
                  setDeferredForm((prev) => ({
                    ...prev,
                    costo_estimado: e.target.value,
                  }))
                }
                placeholder="Ej. 4850.00"
                className="border border-slate-200 rounded-md bg-white text-sm px-3 py-2 w-full font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Fecha Recordatorio
              </label>
              <input
                type="date"
                value={deferredForm.fecha_recordatorio}
                onChange={(e) =>
                  setDeferredForm((prev) => ({
                    ...prev,
                    fecha_recordatorio: e.target.value,
                  }))
                }
                className="border border-slate-200 rounded-md bg-white text-sm px-3 py-2 w-full font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Notas Técnicas / Observación del Mecánico
            </label>
            <textarea
              rows={2}
              value={deferredForm.notas}
              onChange={(e) =>
                setDeferredForm((prev) => ({ ...prev, notas: e.target.value }))
              }
              placeholder="Ej. Presenta fuga de aceite en amortiguador izquierdo, vida útil < 15%..."
              className="border border-slate-200 rounded-md bg-white text-sm px-3 py-2 w-full"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsDeferredModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingDeferred}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md cursor-pointer"
            >
              {savingDeferred ? "Guardando..." : "Guardar Trabajo Diferido"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function ClientProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      }
    >
      <ClientProfileContent />
    </Suspense>
  );
}
