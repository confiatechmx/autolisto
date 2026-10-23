"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Car,
  Building2,
  AlertTriangle,
  MessageCircle,
  Wrench,
  Edit3,
  Crown,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "../../../components/ui/Modal";
import { ClientForm, ClientFormData } from "../../../components/clientes/ClientForm";
import { VehicleForm } from "../../../components/clientes/VehicleForm";

interface Vehicle {
  id: string;
  marca: string;
  modelo: string;
  placas: string | null;
  anio: number;
  vin: string | null;
  color?: string | null;
  kilometraje_actual: number;
  medida_oem?: string | null;
  presion_delantera_psi?: number | null;
  presion_trasera_psi?: number | null;
}

interface DeferredItem {
  id: string;
  vehiculo_id: string;
  cliente_id: string | null;
  concepto: string;
  severidad: "amarillo" | "rojo" | string;
  costo_estimado: number;
  resuelto: boolean;
}

interface Client {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  empresa: string | null;
  rfc: string | null;
  fuente_adquisicion: string | null;
  notas_internas: string | null;
  fechaRegistro: string;
  tags: string[];
  vehiculos: Vehicle[];
  diferidosPendientes: DeferredItem[];
}

type FilterMode = "ALL" | "FLEET" | "DEFERRED" | "VIP";

function cleanWhatsAppPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("52") ? digits : `52${digits}`;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 last:border-0 animate-pulse">
      <td className="px-4 py-3 align-middle">
        <div className="flex flex-col gap-1.5">
          <div className="h-4 bg-slate-200 rounded w-36" />
          <div className="h-3 bg-slate-100 rounded w-24" />
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 bg-slate-200 rounded w-28" />
          <div className="h-3 bg-slate-100 rounded w-32" />
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="h-6 bg-slate-200 rounded-md w-56" />
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <div className="h-7 bg-slate-200 rounded-md w-24 ml-auto" />
      </td>
    </tr>
  );
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientFormData | null>(null);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");
  const router = useRouter();

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [{ data: clientData, error: clientError }, { data: deferredData }] = await Promise.all([
      supabase
        .from("clientes")
        .select(
          `
          id,
          nombre,
          telefono,
          correo,
          empresa,
          rfc,
          fuente_adquisicion,
          notas_internas,
          fecha_registro,
          tags,
          vehiculos (
            id,
            marca,
            modelo,
            placas,
            anio,
            vin,
            color,
            kilometraje_actual,
            medida_oem,
            presion_delantera_psi,
            presion_trasera_psi
          )
        `
        )
        .order("fecha_registro", { ascending: false }),
      supabase
        .from("trabajos_diferidos")
        .select("id, vehiculo_id, cliente_id, concepto, severidad, costo_estimado, resuelto")
        .eq("resuelto", false),
    ]);

    if (clientError) {
      console.error("Error fetching clients:", clientError);
    } else if (clientData) {
      const unresolvedList = (deferredData || []) as DeferredItem[];

      const formatted: Client[] = clientData.map((d: any) => {
        const vehs: Vehicle[] = d.vehiculos || [];
        const vehIds = new Set(vehs.map((v) => v.id));
        const clientDeferred = unresolvedList.filter(
          (df) => df.cliente_id === d.id || vehIds.has(df.vehiculo_id)
        );

        return {
          id: d.id,
          nombre: d.nombre,
          telefono: d.telefono || "Sin teléfono",
          correo: d.correo || "Sin correo",
          empresa: d.empresa || null,
          rfc: d.rfc || null,
          fuente_adquisicion: d.fuente_adquisicion || null,
          notas_internas: d.notas_internas || null,
          fechaRegistro: d.fecha_registro
            ? new Date(d.fecha_registro).toLocaleDateString("es-MX", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Reciente",
          tags: Array.isArray(d.tags) ? d.tags : [],
          vehiculos: vehs,
          diferidosPendientes: clientDeferred,
        };
      });
      setClients(formatted);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filteredClients = clients.filter((client) => {
    // Pill filter
    if (filterMode === "FLEET") {
      const isFleet =
        Boolean(client.empresa) ||
        client.vehiculos.length >= 2 ||
        client.tags.some((t) => t.toLowerCase().includes("flotilla"));
      if (!isFleet) return false;
    } else if (filterMode === "DEFERRED") {
      if (client.diferidosPendientes.length === 0) return false;
    } else if (filterMode === "VIP") {
      const isVip = client.tags.some((t) =>
        ["vip", "frecuente", "corporativo"].includes(t.toLowerCase())
      );
      if (!isVip) return false;
    }

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchName = client.nombre.toLowerCase().includes(query);
    const matchCompany = client.empresa?.toLowerCase().includes(query) || false;
    const matchRfc = client.rfc?.toLowerCase().includes(query) || false;
    const matchPhone = client.telefono.toLowerCase().includes(query);
    const matchVehicle = client.vehiculos.some(
      (v) =>
        v.placas?.toLowerCase().includes(query) ||
        v.marca.toLowerCase().includes(query) ||
        v.modelo.toLowerCase().includes(query) ||
        v.vin?.toLowerCase().includes(query) ||
        v.medida_oem?.toLowerCase().includes(query)
    );
    return matchName || matchCompany || matchRfc || matchPhone || matchVehicle;
  });

  const totalVehicles = clients.reduce((acc, c) => acc + c.vehiculos.length, 0);
  const totalDeferredCount = clients.reduce((acc, c) => acc + c.diferidosPendientes.length, 0);
  const totalDeferredValue = clients.reduce(
    (acc, c) =>
      acc +
      c.diferidosPendientes.reduce((sum, df) => sum + Number(df.costo_estimado || 0), 0),
    0
  );

  return (
    <div className="h-full flex flex-col relative">
      {/* Header & KPIs */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end mb-4 gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              CRM Clientes, Flotillas y Vehículos
            </h1>
            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-xs font-mono font-bold">
              {clients.length} clientes · {totalVehicles} autos
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Expedientes clínicos por unidad, control de flotillas empresariales y seguimiento de trabajos diferidos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalDeferredCount > 0 && (
            <button
              onClick={() =>
                setFilterMode(filterMode === "DEFERRED" ? "ALL" : "DEFERRED")
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                filterMode === "DEFERRED"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <AlertTriangle size={14} />
              <span>
                {totalDeferredCount} Diferidos Pendientes ($
                {totalDeferredValue.toLocaleString("es-MX", {
                  maximumFractionDigits: 0,
                })}
                )
              </span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingClient(null);
              setIsClientModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-md text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            Nuevo Cliente / Flotilla
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="panel-card p-3 mb-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0">
        {/* Search Input */}
        <div className="relative flex-1 max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por cliente, empresa, RFC, teléfono, placas, VIN o medida OEM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-md bg-slate-50/60 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 text-xs transition-all"
          />
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto dense-scrollbar pb-1 lg:pb-0">
          {[
            { id: "ALL" as FilterMode, label: "Todos", icon: Users },
            { id: "FLEET" as FilterMode, label: "Flotillas / Empresas", icon: Building2 },
            {
              id: "DEFERRED" as FilterMode,
              label: "Con Trabajos Diferidos",
              icon: AlertTriangle,
            },
            { id: "VIP" as FilterMode, label: "Clientes VIP", icon: Crown },
          ].map((pill) => {
            const Icon = pill.icon;
            const active = filterMode === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setFilterMode(pill.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Icon size={12} />
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Table Container */}
      <div className="panel-card overflow-hidden flex-1 flex flex-col bg-white">
        {/* Desktop High-Density Table */}
        <div className="hidden md:block overflow-x-auto flex-1 dense-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase min-w-[230px]">
                  Cliente / Empresa
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase min-w-[200px]">
                  Contacto Directo
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase min-w-[360px]">
                  Flotilla / Vehículos (Clic para Expediente Clínico)
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase text-right min-w-[150px]">
                  Acciones Rápidas
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => {
                  const waPhone = cleanWhatsAppPhone(client.telefono);
                  const hasRedDeferred = client.diferidosPendientes.some(
                    (d) => d.severidad === "rojo"
                  );

                  return (
                    <tr
                      key={client.id}
                      onClick={() => router.push(`/clientes/${client.id}`)}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    >
                      {/* Cliente / Empresa */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-blue-600 transition-colors">
                              {client.nombre}
                            </span>
                            {client.diferidosPendientes.length > 0 && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                  hasRedDeferred
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                }`}
                                title="Trabajos diferidos pendientes de autorizar"
                              >
                                ⚠️ {client.diferidosPendientes.length} diferido
                                {client.diferidosPendientes.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>

                          {client.empresa && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                              <Building2 size={12} className="text-blue-500 shrink-0" />
                              <span>{client.empresa}</span>
                              {client.rfc && (
                                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {client.rfc}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[11px] text-slate-400">
                              Alta: {client.fechaRegistro}
                            </span>
                            {client.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Contacto Directo */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-700">
                              <Phone size={12} className="text-slate-400" />
                              {client.telefono}
                            </span>
                            {waPhone && (
                              <a
                                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                  `Hola ${client.nombre}, te contactamos de tu Centro Automotriz.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center justify-center p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                title="Enviar WhatsApp directo"
                              >
                                <MessageCircle size={12} />
                              </a>
                            )}
                          </div>
                          {client.correo !== "Sin correo" && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate max-w-[200px]">
                              <Mail size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{client.correo}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Vehículos Registrados */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {client.vehiculos.length > 0 ? (
                            client.vehiculos.map((v) => {
                              const vehDeferredCount = client.diferidosPendientes.filter(
                                (d) => d.vehiculo_id === v.id
                              ).length;

                              return (
                                <div
                                  key={v.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(
                                      `/clientes/${client.id}?vehiculoId=${v.id}`
                                    );
                                  }}
                                  className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-blue-800 px-2.5 py-1 rounded-md border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                                  title="Abrir expediente clínico de este vehículo"
                                >
                                  <Car size={12} className="text-slate-400 shrink-0" />
                                  <span className="text-[11px] font-bold tracking-tight">
                                    {v.marca} {v.modelo} &apos;
                                    {String(v.anio).slice(-2)}
                                  </span>
                                  {v.placas && (
                                    <span className="font-mono text-[10px] bg-white px-1.5 py-0.2 rounded border border-slate-200 font-bold text-slate-700">
                                      {v.placas}
                                    </span>
                                  )}
                                  {v.medida_oem && (
                                    <span className="font-mono text-[10px] text-slate-500 hidden xl:inline">
                                      ({v.medida_oem})
                                    </span>
                                  )}
                                  {vehDeferredCount > 0 && (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1 rounded">
                                      ⚠️{vehDeferredCount}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedClientId(client.id);
                                      setSelectedVehicle(v);
                                      setIsVehicleModalOpen(true);
                                    }}
                                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-200/60 transition-colors"
                                    title="Editar datos técnicos del vehículo"
                                  >
                                    <Edit3 size={11} />
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Sin unidades registradas
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClientId(client.id);
                              setSelectedVehicle(null);
                              setIsVehicleModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-dashed border-slate-300 text-[11px] font-semibold text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Añadir vehículo a este cliente"
                          >
                            <Plus size={12} /> Auto
                          </button>
                        </div>
                      </td>

                      {/* Acciones Rápidas */}
                      <td className="px-4 py-3 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const firstVehId = client.vehiculos[0]?.id || "";
                              const url = firstVehId
                                ? `/tablero?nuevaOrden=1&clienteId=${client.id}&vehiculoId=${firstVehId}`
                                : `/tablero?nuevaOrden=1&clienteId=${client.id}`;
                              router.push(url);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-xs font-bold transition-colors cursor-pointer"
                            title="Crear nueva orden de servicio en Tablero"
                          >
                            <Wrench size={12} />+ Orden
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingClient({
                                id: client.id,
                                nombre: client.nombre,
                                telefono:
                                  client.telefono === "Sin teléfono"
                                    ? ""
                                    : client.telefono,
                                correo:
                                  client.correo === "Sin correo" ? "" : client.correo,
                                empresa: client.empresa,
                                rfc: client.rfc,
                                fuente_adquisicion: client.fuente_adquisicion,
                                notas_internas: client.notas_internas,
                                tags: client.tags,
                              });
                              setIsClientModalOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                            title="Editar cliente"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-500 text-sm">
                    No se encontraron clientes o vehículos con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
          {loading ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              Cargando directorio...
            </div>
          ) : filteredClients.length > 0 ? (
            filteredClients.map((client) => {
              const waPhone = cleanWhatsAppPhone(client.telefono);
              return (
                <div
                  key={client.id}
                  onClick={() => router.push(`/clientes/${client.id}`)}
                  className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col gap-2.5 cursor-pointer"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {client.nombre}
                        </span>
                        {client.diferidosPendientes.length > 0 && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            ⚠️ {client.diferidosPendientes.length} diferidos
                          </span>
                        )}
                      </div>
                      {client.empresa && (
                        <span className="text-xs font-semibold text-blue-700 block">
                          {client.empresa}
                        </span>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-mono mt-1">
                        <Phone size={12} className="text-slate-400" />
                        {client.telefono}
                        {waPhone && (
                          <a
                            href={`https://wa.me/${waPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-emerald-600 font-sans font-bold underline"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const firstVehId = client.vehiculos[0]?.id || "";
                        router.push(
                          `/tablero?nuevaOrden=1&clienteId=${client.id}${
                            firstVehId ? `&vehiculoId=${firstVehId}` : ""
                          }`
                        );
                      }}
                      className="bg-blue-600 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-md shrink-0"
                    >
                      + Orden
                    </button>
                  </div>

                  {/* Vehiculos (Mobile) */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    {client.vehiculos.map((v) => (
                      <span
                        key={v.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/clientes/${client.id}?vehiculoId=${v.id}`);
                        }}
                        className="bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold px-2 py-1 rounded"
                      >
                        {v.marca} {v.modelo} {v.placas ? `• ${v.placas}` : ""}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClientId(client.id);
                        setSelectedVehicle(null);
                        setIsVehicleModalOpen(true);
                      }}
                      className="flex items-center gap-1 bg-slate-50 border border-dashed border-slate-300 text-slate-600 px-2 py-1 rounded text-[11px] font-semibold"
                    >
                      <Plus size={11} /> Auto
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-slate-500 text-xs">
              No se encontraron clientes.
            </div>
          )}
        </div>
      </div>

      {/* Modal for New/Edit Client */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => {
          setIsClientModalOpen(false);
          setEditingClient(null);
        }}
        title={editingClient ? "Editar Cliente / Flotilla" : "Registrar Nuevo Cliente"}
        description="Gestiona los datos de contacto, RFC, flotilla y etiquetas CRM."
      >
        <ClientForm
          initialData={editingClient}
          onSuccess={() => {
            setIsClientModalOpen(false);
            setEditingClient(null);
            fetchClients();
          }}
          onCancel={() => {
            setIsClientModalOpen(false);
            setEditingClient(null);
          }}
        />
      </Modal>

      {/* Modal for New/Edit Vehicle */}
      <Modal
        isOpen={isVehicleModalOpen}
        onClose={() => {
          setIsVehicleModalOpen(false);
          setSelectedClientId(null);
          setSelectedVehicle(null);
        }}
        title={selectedVehicle ? "Ficha Técnica del Vehículo" : "Registrar Vehículo"}
        description="Especificaciones OEM de llantas, presión PSI, VIN y kilometraje."
      >
        {selectedClientId && (
          <VehicleForm
            clientId={selectedClientId}
            initialData={selectedVehicle}
            onSuccess={() => {
              setIsVehicleModalOpen(false);
              setSelectedClientId(null);
              setSelectedVehicle(null);
              fetchClients();
            }}
            onCancel={() => {
              setIsVehicleModalOpen(false);
              setSelectedClientId(null);
              setSelectedVehicle(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
