"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/context/TenantContext";
import {
  Loader2,
  Car,
  User,
  Wrench,
  AlertTriangle,
  Building2,
  Gauge,
  CheckSquare,
} from "lucide-react";

interface Vehicle {
  id: string;
  marca: string;
  modelo: string;
  anio?: number;
  placas: string | null;
  kilometraje_actual?: number;
}

interface Client {
  id: string;
  nombre: string;
  telefono?: string | null;
  vehiculos: Vehicle[];
}

export interface OrderFormProps {
  onSuccess: (createdOrderId?: string) => void;
  onCancel: () => void;
  initialClientId?: string | null;
  initialVehicleId?: string | null;
  initialDiferidoId?: string | null;
}

const BAHIAS_TALLER = [
  "Rampa 1 (Alineación)",
  "Rampa 2 (Frenos / Susp.)",
  "Rampa 3 (Mecánica Gral.)",
  "Rampa 4 (Servicio Rápido)",
  "Bahía Diagnóstico",
];

export function OrderForm({
  onSuccess,
  onCancel,
  initialClientId,
  initialVehicleId,
  initialDiferidoId,
}: OrderFormProps) {
  const { sucursales, sucursalActiva, empresa } = useTenant();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [vehicleDeferredWorks, setVehicleDeferredWorks] = useState<any[]>([]);
  const [selectedDeferredIds, setSelectedDeferredIds] = useState<string[]>(
    initialDiferidoId ? [initialDiferidoId] : []
  );

  const [selectedClientId, setSelectedClientId] = useState(initialClientId || "");
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || "");

  const [formData, setFormData] = useState({
    sucursal_id: sucursalActiva?.id || "",
    mecanico_id: "",
    bahia_rampa: "Bahía Diagnóstico",
    prioridad: "normal",
    kilometraje_ingreso: "",
    nivel_gasolina: "1/2",
    problema_reportado: "",
    notas_recepcion: "",
  });

  useEffect(() => {
    if (sucursalActiva?.id && !formData.sucursal_id) {
      setFormData((prev) => ({ ...prev, sucursal_id: sucursalActiva.id }));
    } else if (!formData.sucursal_id && sucursales.length > 0) {
      setFormData((prev) => ({ ...prev, sucursal_id: sucursales[0].id }));
    }
  }, [sucursalActiva, sucursales]);

  useEffect(() => {
    async function loadInitialData() {
      setFetchingData(true);
      const [{ data: clientsData }, { data: mechData }] = await Promise.all([
        supabase
          .from("clientes")
          .select(
            `
            id,
            nombre,
            telefono,
            vehiculos (id, marca, modelo, anio, placas, kilometraje_actual)
          `
          )
          .order("nombre", { ascending: true }),
        supabase
          .from("empleados")
          .select("id, nombre, especialidad, rol")
          .eq("rol", "Mecánico")
          .eq("activo", true)
          .order("nombre"),
      ]);

      if (clientsData) {
        const typedClients = clientsData as Client[];
        setClients(typedClients);

        if (initialVehicleId && !initialClientId) {
          const owner = typedClients.find((c) =>
            c.vehiculos?.some((v) => v.id === initialVehicleId)
          );
          if (owner) {
            setSelectedClientId(owner.id);
            const veh = owner.vehiculos.find((v) => v.id === initialVehicleId);
            if (veh?.kilometraje_actual) {
              setFormData((prev) => ({
                ...prev,
                kilometraje_ingreso: String(veh.kilometraje_actual),
              }));
            }
          }
        } else if (initialClientId) {
          setSelectedClientId(initialClientId);
          const owner = typedClients.find((c) => c.id === initialClientId);
          if (initialVehicleId) {
            setSelectedVehicleId(initialVehicleId);
            const veh = owner?.vehiculos?.find((v) => v.id === initialVehicleId);
            if (veh?.kilometraje_actual) {
              setFormData((prev) => ({
                ...prev,
                kilometraje_ingreso: String(veh.kilometraje_actual),
              }));
            }
          } else if (owner?.vehiculos?.length === 1) {
            const singleVeh = owner.vehiculos[0];
            setSelectedVehicleId(singleVeh.id);
            if (singleVeh.kilometraje_actual) {
              setFormData((prev) => ({
                ...prev,
                kilometraje_ingreso: String(singleVeh.kilometraje_actual),
              }));
            }
          }
        }
      }

      if (mechData) setMechanics(mechData);
      setFetchingData(false);
    }
    loadInitialData();
  }, [initialClientId, initialVehicleId]);

  // Load unresolved trabajos_diferidos whenever selectedVehicleId changes
  useEffect(() => {
    async function loadVehicleDeferred() {
      if (!selectedVehicleId) {
        setVehicleDeferredWorks([]);
        return;
      }
      const { data } = await supabase
        .from("trabajos_diferidos")
        .select("*")
        .eq("vehiculo_id", selectedVehicleId)
        .eq("resuelto", false)
        .order("created_at", { ascending: false });

      if (data) {
        setVehicleDeferredWorks(data);
        if (initialDiferidoId && data.some((d) => d.id === initialDiferidoId)) {
          setSelectedDeferredIds((prev) =>
            prev.includes(initialDiferidoId) ? prev : [...prev, initialDiferidoId]
          );
        }
      }
    }
    loadVehicleDeferred();
  }, [selectedVehicleId, initialDiferidoId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleDeferredSelection = (id: string) => {
    setSelectedDeferredIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      setError("Debes seleccionar un vehículo para crear la orden.");
      return;
    }

    setLoading(true);
    setError("");

    const kmIngreso = parseInt(formData.kilometraje_ingreso) || 0;
    const { data: createdOrder, error: dbError } = await supabase
      .from("ordenes_servicio")
      .insert({
        vehiculo_id: selectedVehicleId,
        sucursal_id: formData.sucursal_id || sucursalActiva?.id || sucursales[0]?.id || null,
        mecanico_id: formData.mecanico_id || null,
        bahia_rampa: formData.bahia_rampa || null,
        prioridad: formData.prioridad || "normal",
        nivel_gasolina: formData.nivel_gasolina,
        kilometraje_ingreso: kmIngreso,
        problema_reportado: formData.problema_reportado || formData.notas_recepcion || null,
        notas_recepcion: formData.notas_recepcion || formData.problema_reportado || null,
        estado: "Citas del Día",
        sub_estado: "Activa",
      })
      .select("id")
      .single();

    if (dbError || !createdOrder) {
      setLoading(false);
      setError(dbError?.message || "No se pudo crear la orden.");
      return;
    }

    // Update vehicle kilometraje_actual if greater
    if (kmIngreso > 0) {
      await supabase
        .from("vehiculos")
        .update({ kilometraje_actual: kmIngreso })
        .eq("id", selectedVehicleId);
    }

    // Attach any selected deferred works to the new order
    if (selectedDeferredIds.length > 0) {
      const selectedItems = vehicleDeferredWorks.filter((d) =>
        selectedDeferredIds.includes(d.id)
      );
      const margenDefault = Number(empresa?.margen_refacciones_default ?? 35);

      for (const item of selectedItems) {
        const precioVenta = Number(item.costo_estimado || 1100);
        const costoUnit = Math.round((precioVenta / (1 + margenDefault / 100)) * 100) / 100;

        await supabase.from("orden_servicio_refacciones").insert({
          orden_servicio_id: createdOrder.id,
          nombre: item.concepto,
          numero_parte: "DIF-PEND",
          proveedor: "AutoZone Comercial",
          cantidad: 1,
          costo_unitario: costoUnit,
          margen_porcentaje: margenDefault,
          precio_unitario: precioVenta,
          subtotal: precioVenta,
          estatus_aprobacion: "Aprobado",
        });

        await supabase
          .from("trabajos_diferidos")
          .update({ resuelto: true })
          .eq("id", item.id);
      }
    }

    setLoading(false);
    onSuccess(createdOrder.id);
  };

  const inputClasses =
    "border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-md bg-white text-xs p-2 w-full transition-all text-slate-900 outline-none";
  const labelClasses = "block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1";

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const availableVehicles = selectedClient?.vehiculos || [];

  if (fetchingData) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 size={24} className="animate-spin text-blue-600" />
        <p className="text-xs font-medium">Cargando padrón de clientes y unidades...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="p-5 space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 text-xs font-medium p-3 rounded-md border border-red-200">
            {error}
          </div>
        )}

        {/* 1. Identificación de Cliente y Vehículo */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
            <User size={14} className="text-blue-600" /> 1. Cliente y Unidad
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Cliente Titular</label>
              <select
                required
                value={selectedClientId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setSelectedClientId(cid);
                  const cl = clients.find((c) => c.id === cid);
                  if (cl?.vehiculos?.length === 1) {
                    setSelectedVehicleId(cl.vehiculos[0].id);
                    if (cl.vehiculos[0].kilometraje_actual) {
                      setFormData((prev) => ({
                        ...prev,
                        kilometraje_ingreso: String(cl.vehiculos[0].kilometraje_actual),
                      }));
                    }
                  } else {
                    setSelectedVehicleId("");
                  }
                }}
                className={inputClasses}
              >
                <option value="" disabled>
                  Selecciona un cliente...
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.vehiculos?.length || 0} autos)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Vehículo a Ingresar</label>
              <select
                required
                disabled={!selectedClientId || availableVehicles.length === 0}
                value={selectedVehicleId}
                onChange={(e) => {
                  const vid = e.target.value;
                  setSelectedVehicleId(vid);
                  const veh = availableVehicles.find((v) => v.id === vid);
                  if (veh?.kilometraje_actual) {
                    setFormData((prev) => ({
                      ...prev,
                      kilometraje_ingreso: String(veh.kilometraje_actual),
                    }));
                  }
                }}
                className={inputClasses}
              >
                <option value="" disabled>
                  {!selectedClientId
                    ? "Primero selecciona un cliente"
                    : availableVehicles.length === 0
                    ? "Cliente sin vehículos"
                    : "Selecciona un vehículo..."}
                </option>
                {availableVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.anio ? `(${v.anio})` : ""}{" "}
                    {v.placas ? `[${v.placas}]` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Deferred Works Alert inside New Order Form */}
          {vehicleDeferredWorks.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600" />
                  Este vehículo tiene {vehicleDeferredWorks.length} trabajo(s) diferido(s) de visitas anteriores
                </span>
                <span className="text-[10px] font-semibold text-amber-800">
                  Marca para incluir en la orden
                </span>
              </div>
              <div className="space-y-1.5">
                {vehicleDeferredWorks.map((dif) => {
                  const isChecked = selectedDeferredIds.includes(dif.id);
                  return (
                    <label
                      key={dif.id}
                      className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-white border-amber-500 shadow-2xs"
                          : "bg-amber-50/50 border-amber-200/80"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDeferredSelection(dif.id)}
                          className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <span className="font-bold text-slate-900">{dif.concepto}</span>
                          {dif.categoria && (
                            <span className="text-[10px] text-slate-500 ml-1.5">
                              ({dif.categoria})
                            </span>
                          )}
                        </div>
                      </div>
                      {dif.costo_estimado && (
                        <span className="font-mono font-bold text-slate-800 tabular-nums">
                          ${Number(dif.costo_estimado).toLocaleString("es-MX")}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. Asignación Operativa (Sucursal, Técnico, Bahía, Prioridad) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
            <Wrench size={14} className="text-blue-600" /> 2. Asignación de Taller y Rampa
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClasses}>Sucursal</label>
              <select
                name="sucursal_id"
                value={formData.sucursal_id}
                onChange={handleChange}
                className={inputClasses}
              >
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.codigo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Técnico Asignado</label>
              <select
                name="mecanico_id"
                value={formData.mecanico_id}
                onChange={handleChange}
                className={inputClasses}
              >
                <option value="">Por asignar en piso</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {m.especialidad ? `• ${m.especialidad}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Bahía / Rampa</label>
              <select
                name="bahia_rampa"
                value={formData.bahia_rampa}
                onChange={handleChange}
                className={inputClasses}
              >
                {BAHIAS_TALLER.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Prioridad</label>
              <select
                name="prioridad"
                value={formData.prioridad}
                onChange={handleChange}
                className={inputClasses}
              >
                <option value="low">Baja (Programada)</option>
                <option value="normal">Normal (Estándar)</option>
                <option value="high">Alta (Express)</option>
                <option value="urgent">Urgente (Garantía / Flotilla)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Check-in de Recepción */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
            <Car size={14} className="text-blue-600" /> 3. Check-in de Recepción
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Kilometraje de Ingreso (km)</label>
              <input
                required
                type="number"
                min="0"
                name="kilometraje_ingreso"
                value={formData.kilometraje_ingreso}
                onChange={handleChange}
                placeholder="Ej. 54200"
                className={`${inputClasses} font-mono font-bold tabular-nums`}
              />
            </div>

            <div>
              <label className={labelClasses}>Nivel de Combustible</label>
              <select
                required
                name="nivel_gasolina"
                value={formData.nivel_gasolina}
                onChange={handleChange}
                className={inputClasses}
              >
                <option value="Vacío">Vacío (Reserva)</option>
                <option value="1/4">1/4 de Tanque</option>
                <option value="1/2">1/2 Tanque</option>
                <option value="3/4">3/4 de Tanque</option>
                <option value="Lleno">Tanque Lleno</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClasses}>Síntoma / Problema Reportado por el Cliente</label>
            <textarea
              rows={2}
              name="problema_reportado"
              value={formData.problema_reportado}
              onChange={handleChange}
              placeholder="Ej. Vibración en el volante a 90 km/h y rechinido en frenos delanteros..."
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Notas de Recepción / Observaciones de Carrocería</label>
            <textarea
              rows={2}
              name="notas_recepcion"
              value={formData.notas_recepcion}
              onChange={handleChange}
              placeholder="Ej. Cliente deja birlo de seguridad en guantera. Rayón previo en facia trasera derecha..."
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !selectedVehicleId}
          className="px-5 py-2 text-xs font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? "Abriendo Orden..." : "Crear Orden de Servicio"}
        </button>
      </div>
    </form>
  );
}
