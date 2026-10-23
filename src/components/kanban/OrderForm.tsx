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
  Sparkles,
  Zap,
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

  // Mode: Express New Ingestion vs Registered Selection
  const [isExpressMode, setIsExpressMode] = useState(false);
  const [expressClientName, setExpressClientName] = useState("");
  const [expressClientPhone, setExpressClientPhone] = useState("");
  const [expressVehicleMarca, setExpressVehicleMarca] = useState("");
  const [expressVehicleModelo, setExpressVehicleModelo] = useState("");
  const [expressVehiclePlacas, setExpressVehiclePlacas] = useState("");
  const [expressVehicleAnio, setExpressVehicleAnio] = useState(String(new Date().getFullYear()));

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
    setLoading(true);
    setError("");

    let targetVehicleId = selectedVehicleId;
    const kmIngreso = parseInt(formData.kilometraje_ingreso) || 0;

    // Express New Ingestion Logic
    if (isExpressMode) {
      if (!expressClientName.trim() || !expressClientPhone.trim()) {
        setError("Por favor ingresa el nombre y teléfono del cliente.");
        setLoading(false);
        return;
      }
      if (!expressVehicleMarca.trim() || !expressVehicleModelo.trim()) {
        setError("Por favor ingresa la marca y modelo del vehículo.");
        setLoading(false);
        return;
      }

      // 1. Create client
      const { data: newClient, error: clientErr } = await supabase
        .from("clientes")
        .insert({
          empresa_id: empresa?.id || null,
          nombre: expressClientName.trim(),
          telefono: expressClientPhone.trim(),
          tags: ["Ingreso Express Mostrador"],
        })
        .select("id")
        .single();

      if (clientErr || !newClient) {
        setError(clientErr?.message || "Error al crear el cliente.");
        setLoading(false);
        return;
      }

      // 2. Create vehicle
      const { data: newVehicle, error: vehicleErr } = await supabase
        .from("vehiculos")
        .insert({
          cliente_id: newClient.id,
          marca: expressVehicleMarca.trim(),
          modelo: expressVehicleModelo.trim(),
          placas: expressVehiclePlacas.trim().toUpperCase() || null,
          anio: parseInt(expressVehicleAnio) || new Date().getFullYear(),
          kilometraje_actual: kmIngreso || null,
        })
        .select("id")
        .single();

      if (vehicleErr || !newVehicle) {
        setError(vehicleErr?.message || "Error al registrar el vehículo.");
        setLoading(false);
        return;
      }

      targetVehicleId = newVehicle.id;
    } else {
      if (!targetVehicleId) {
        setError("Debes seleccionar un vehículo para crear la orden.");
        setLoading(false);
        return;
      }
    }

    // 3. Create Service Order
    const { data: createdOrder, error: dbError } = await supabase
      .from("ordenes_servicio")
      .insert({
        vehiculo_id: targetVehicleId,
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
        .eq("id", targetVehicleId);
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
          precio_unitario: precioVenta,
          subtotal: precioVenta,
          estatus_aprobacion: "Pendiente",
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

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const availableVehicles = selectedClient?.vehiculos || [];

  const inputClasses =
    "w-full text-xs font-semibold border border-slate-300 rounded-md p-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 shadow-2xs";
  const labelClasses = "block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1";

  if (fetchingData) {
    return (
      <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="animate-spin text-blue-600" size={28} />
        <span className="text-xs font-semibold">Cargando catálogo y clientes...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto dense-scrollbar">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md font-semibold">
          {error}
        </div>
      )}

      {/* Mode Toggle: Express New Ingestion vs Registered Selection */}
      <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <Zap size={16} className={isExpressMode ? "text-amber-500" : "text-slate-400"} />
          <span className="text-xs font-bold text-slate-800">
            {isExpressMode ? "Modo: Recepción Express (Cliente y Auto Nuevo)" : "Modo: Cliente / Vehículo Existente"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsExpressMode(!isExpressMode);
            setError("");
          }}
          className={`text-xs font-bold px-3 py-1 rounded-md transition-colors cursor-pointer ${
            isExpressMode
              ? "bg-amber-500 hover:bg-amber-600 text-white"
              : "bg-white hover:bg-slate-200 text-slate-700 border border-slate-300"
          }`}
        >
          {isExpressMode ? "Cambiar a Cliente Registrado" : "⚡ Alta Rápida de Auto en Patio"}
        </button>
      </div>

      {/* Branch Selection if multiple */}
      {sucursales.length > 1 && (
        <div>
          <label className={labelClasses}>Sucursal de Atención</label>
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
      )}

      {/* SECTION 1: Client & Vehicle Identification */}
      {isExpressMode ? (
        <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3.5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
            <Zap size={14} className="text-amber-600" /> Datos del Nuevo Cliente y Unidad en Patio
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Nombre Completo del Titular *</label>
              <input
                type="text"
                required={isExpressMode}
                value={expressClientName}
                onChange={(e) => setExpressClientName(e.target.value)}
                placeholder="Ej. Roberto Sánchez Martínez"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>WhatsApp / Teléfono Celular *</label>
              <input
                type="tel"
                required={isExpressMode}
                value={expressClientPhone}
                onChange={(e) => setExpressClientPhone(e.target.value)}
                placeholder="Ej. 81 1234 5678"
                className={inputClasses}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClasses}>Marca *</label>
              <input
                type="text"
                required={isExpressMode}
                value={expressVehicleMarca}
                onChange={(e) => setExpressVehicleMarca(e.target.value)}
                placeholder="Ej. Nissan"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Modelo *</label>
              <input
                type="text"
                required={isExpressMode}
                value={expressVehicleModelo}
                onChange={(e) => setExpressVehicleModelo(e.target.value)}
                placeholder="Ej. Versa Sense"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Placas</label>
              <input
                type="text"
                value={expressVehiclePlacas}
                onChange={(e) => setExpressVehiclePlacas(e.target.value)}
                placeholder="Ej. STN-492-B"
                className={`${inputClasses} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={labelClasses}>Año</label>
              <input
                type="number"
                value={expressVehicleAnio}
                onChange={(e) => setExpressVehicleAnio(e.target.value)}
                placeholder="2022"
                className={inputClasses}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
            <User size={14} className="text-blue-600" /> 1. Cliente y Unidad Registrada
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Cliente Titular</label>
              <select
                required={!isExpressMode}
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
                required={!isExpressMode}
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
                    ? "Cliente sin vehículos registrados"
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
                          : "bg-white/60 border-amber-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDeferredSelection(dif.id)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300"
                        />
                        <span className="font-semibold text-slate-800">{dif.concepto}</span>
                      </div>
                      <span className="font-bold text-slate-900 tabular-nums">
                        ${Number(dif.costo_estimado || 0).toLocaleString("es-MX")}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Operation & Bay Assignment */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
          <Wrench size={14} className="text-blue-600" /> 2. Asignación y Operación
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <label className={labelClasses}>Técnico Mecánico</label>
            <select
              name="mecanico_id"
              value={formData.mecanico_id}
              onChange={handleChange}
              className={inputClasses}
            >
              <option value="">(Sin asignar en recepción)</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} {m.especialidad ? `• ${m.especialidad}` : ""}
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
              <option value="normal">Normal</option>
              <option value="urgente">⚡ Urgente / Espera en Sala</option>
              <option value="flotilla">🚚 Flotilla Comercial</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Kilometraje de Entrada</label>
            <input
              type="number"
              name="kilometraje_ingreso"
              value={formData.kilometraje_ingreso}
              onChange={handleChange}
              placeholder="Ej. 68500"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Nivel de Gasolina</label>
            <select
              name="nivel_gasolina"
              value={formData.nivel_gasolina}
              onChange={handleChange}
              className={inputClasses}
            >
              <option value="Reserva">Reserva (E)</option>
              <option value="1/4">1/4 de Tanque</option>
              <option value="1/2">1/2 de Tanque</option>
              <option value="3/4">3/4 de Tanque</option>
              <option value="Lleno">Tanque Lleno (F)</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClasses}>Motivo de Ingreso / Falla Reportada por el Cliente *</label>
          <textarea
            required
            name="problema_reportado"
            rows={2}
            value={formData.problema_reportado}
            onChange={handleChange}
            placeholder="Ej. Ruido al frenar en frío y testigo de Check Engine encendido..."
            className={`${inputClasses} resize-none`}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 rounded-md border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{ backgroundColor: empresa?.color_primario || "#0284c7" }}
          className="px-5 py-2 rounded-md text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={14} /> Creando Orden...
            </>
          ) : (
            <>
              <Sparkles size={14} /> Crear Orden de Servicio
            </>
          )}
        </button>
      </div>
    </form>
  );
}
