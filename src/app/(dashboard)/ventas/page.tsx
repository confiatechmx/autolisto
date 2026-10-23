"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, GripVertical, Target, Phone, Calendar, CheckCircle2, XCircle, ArrowRight, Building2, User, Car } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/context/TenantContext";
import { toast } from "sonner";
import Link from "next/link";

interface Oportunidad {
  id: string;
  cliente_id: string;
  monto_estimado: number;
  estado: string;
  creado_en: string;
  cliente?: { nombre: string; telefono: string };
}

const COLUMNS = [
  { id: 'nuevo', label: 'Nuevos Leads', color: 'border-blue-500 bg-blue-50/50 text-blue-700' },
  { id: 'contactado', label: 'Contactado', color: 'border-purple-500 bg-purple-50/50 text-purple-700' },
  { id: 'cita_agendada', label: 'Cita Agendada', color: 'border-amber-500 bg-amber-50/50 text-amber-700' },
  { id: 'ganado', label: 'Ganado (En Taller)', color: 'border-emerald-500 bg-emerald-50/50 text-emerald-700' },
  { id: 'perdido', label: 'Perdido', color: 'border-rose-500 bg-rose-50/50 text-rose-700' }
];

export default function VentasPipelinePage() {
  const supabase = createClient();
  const { empresa, sucursalActiva } = useTenant();

  const [opportunities, setOpportunities] = useState<Oportunidad[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual Opp State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isManualAdvancedOpen, setIsManualAdvancedOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualEmpresa, setManualEmpresa] = useState("");
  const [manualFuente, setManualFuente] = useState("Local");
  const [manualNotas, setManualNotas] = useState("");

  // Ganado (Won) Opp State
  const [isGanadoModalOpen, setIsGanadoModalOpen] = useState(false);
  const [wonOppId, setWonOppId] = useState("");
  const [vehicleMarca, setVehicleMarca] = useState("");
  const [vehicleModelo, setVehicleModelo] = useState("");
  const [vehiclePlacas, setVehiclePlacas] = useState("");
  const [vehicleVin, setVehicleVin] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleKm, setVehicleKm] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('oportunidades_venta')
      .select('*, cliente:clientes(nombre, telefono)')
      .order('creado_en', { ascending: false });
    
    if (data) {
      setOpportunities(data as Oportunidad[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const moveOpportunity = async (id: string, newStatus: string) => {
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, estado: newStatus } : o));
    await supabase.from('oportunidades_venta').update({ estado: newStatus }).eq('id', id);
    toast.info(`Oportunidad movida a: ${newStatus}`);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("id", id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    const id = e.dataTransfer.getData("id");
    if (id) {
      if (status === 'ganado') {
        setWonOppId(id);
        setIsGanadoModalOpen(true);
      } else {
        moveOpportunity(id, status);
      }
    }
  };

  const handleCreateManualOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualPhone.trim()) return;

    const { data: newClient, error: clientErr } = await supabase.from('clientes').insert({
      empresa_id: empresa?.id || null,
      nombre: manualName,
      telefono: manualPhone,
      correo: '',
      empresa: manualEmpresa || null,
      fuente_adquisicion: manualFuente,
      notas_internas: manualNotas || null,
      tags: ['Prospecto Manual']
    }).select().single();

    if (newClient) {
      await supabase.from('oportunidades_venta').insert({
        empresa_id: empresa?.id || null,
        sucursal_id: sucursalActiva?.id || null,
        cliente_id: newClient.id,
        monto_estimado: Number(manualAmount) || 0,
        estado: 'nuevo'
      });
      
      setIsManualModalOpen(false);
      setIsManualAdvancedOpen(false);
      setManualName("");
      setManualPhone("");
      setManualAmount("");
      setManualEmpresa("");
      setManualFuente("Local");
      setManualNotas("");
      toast.success("Prospecto agregado exitosamente al Pipeline.");
      loadData();
    }
  };

  const handleConfirmGanado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wonOppId || !vehicleMarca) return;

    const opp = opportunities.find(o => o.id === wonOppId);
    if (!opp) return;

    // 1. Crear vehículo
    const { data: newVehicle } = await supabase.from('vehiculos').insert({
      cliente_id: opp.cliente_id,
      marca: vehicleMarca,
      modelo: vehicleModelo,
      placas: vehiclePlacas ? vehiclePlacas.toUpperCase() : null,
      vin: vehicleVin || null,
      color: vehicleColor || null,
      kilometraje_actual: Number(vehicleKm) || null,
      anio: new Date().getFullYear()
    }).select().single();

    if (newVehicle) {
      // 2. Crear orden de servicio en "Citas del Día" para que caiga directo en el Kanban
      const { data: newOrder } = await supabase.from('ordenes_servicio').insert({
        empresa_id: empresa?.id || null,
        sucursal_id: sucursalActiva?.id || null,
        vehiculo_id: newVehicle.id,
        estado: 'Citas del Día',
        estatus_pago: 'Pendiente',
        problema_reportado: `Ingreso desde Pipeline Comercial (Estimado: $${opp.monto_estimado})`
      }).select().single();

      // 3. Actualizar estado opp a ganado
      await moveOpportunity(wonOppId, 'ganado');
      
      setIsGanadoModalOpen(false);
      setWonOppId("");
      setVehicleMarca("");
      setVehicleModelo("");
      setVehiclePlacas("");
      setVehicleVin("");
      setVehicleColor("");
      setVehicleKm("");
      toast.success("¡Cliente convertido! Orden creada en el Workflow de Taller.");
    }
  };

  const totalPipelineMonto = opportunities.reduce((acc, o) => acc + Number(o.monto_estimado || 0), 0);
  const totalWonMonto = opportunities.filter(o => o.estado === 'ganado').reduce((acc, o) => acc + Number(o.monto_estimado || 0), 0);
  const conversionRate = opportunities.length > 0 ? (opportunities.filter(o => o.estado === 'ganado').length / opportunities.length) * 100 : 0;

  return (
    <div className="h-full flex flex-col relative space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Target className="w-6 h-6 text-sky-600" />
              Pipeline de Ventas y Prospectos (CRM)
            </h1>
            <span className="bg-sky-100 text-sky-800 text-[11px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Leads Taller
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Convierte cotizaciones y llamadas en órdenes de trabajo en el tablero operativo.
          </p>
        </div>

        {/* Scorecard quick pills */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">En Cartera</span>
              <span className="font-extrabold text-slate-900 tabular-nums">${totalPipelineMonto.toLocaleString("es-MX")}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Ganado</span>
              <span className="font-extrabold text-emerald-600 tabular-nums">${totalWonMonto.toLocaleString("es-MX")}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Conversión</span>
              <span className="font-extrabold text-slate-800">{conversionRate.toFixed(0)}%</span>
            </div>
          </div>

          <button 
            onClick={() => setIsManualModalOpen(true)}
            style={{ backgroundColor: empresa?.color_primario || "#0284c7" }}
            className="text-white hover:opacity-95 px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>Nuevo Prospecto</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="flex-1 overflow-x-auto pb-4 dense-scrollbar">
        <div className="flex gap-3.5 h-[calc(100vh-210px)] min-w-max">
          {COLUMNS.map((col) => {
            const columnOps = opportunities.filter(o => o.estado === col.id);
            const columnTotal = columnOps.reduce((acc, curr) => acc + Number(curr.monto_estimado), 0);

            return (
              <div 
                key={col.id} 
                className="w-72 sm:w-80 flex flex-col h-full bg-slate-100/70 border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                      {col.label}
                    </span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 tabular-nums">
                      {columnOps.length}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-700 tabular-nums">
                    ${columnTotal.toLocaleString('es-MX')}
                  </span>
                </div>

                {/* Cards List */}
                <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5 dense-scrollbar">
                  {columnOps.map((opp) => (
                    <div 
                      key={opp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, opp.id)}
                      className="p-3.5 bg-white border border-slate-200/90 rounded-lg shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5 truncate">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{opp.cliente?.nombre || 'Prospecto sin nombre'}</span>
                        </div>
                        <GripVertical size={13} className="text-slate-300 group-hover:text-slate-600 shrink-0" />
                      </div>

                      {opp.cliente?.telefono && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-2 font-mono">
                          <Phone size={11} className="text-slate-400 shrink-0" />
                          <span>{opp.cliente.telefono}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Monto Proyectado:</span>
                        <span className="font-black text-slate-900 tabular-nums">
                          ${Number(opp.monto_estimado || 0).toLocaleString('es-MX')}
                        </span>
                      </div>

                      {opp.estado !== 'ganado' && (
                        <button
                          type="button"
                          onClick={() => {
                            setWonOppId(opp.id);
                            setIsGanadoModalOpen(true);
                          }}
                          className="mt-2 w-full py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={12} /> Convertir a Orden Taller
                        </button>
                      )}
                    </div>
                  ))}

                  {columnOps.length === 0 && (
                    <div className="h-28 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-center p-3 text-xs text-slate-400">
                      Arrastra prospectos a esta columna
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Nuevo Prospecto Manual */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleCreateManualOpp}
            className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={15} className="text-sky-600" />
                Registrar Prospecto Manual
              </h2>
              <button 
                type="button" 
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre del Cliente *</label>
              <input 
                type="text" 
                required
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Ej. Roberto Méndez"
                className="w-full text-xs font-medium border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">WhatsApp / Teléfono *</label>
              <input 
                type="tel" 
                required
                value={manualPhone}
                onChange={e => setManualPhone(e.target.value)}
                placeholder="Ej. 81 2345 6789"
                className="w-full text-xs font-medium border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Presupuesto Estimado ($)</label>
              <input 
                type="number" 
                value={manualAmount}
                onChange={e => setManualAmount(e.target.value)}
                placeholder="Ej. 4500"
                className="w-full text-xs font-bold border border-slate-300 rounded-md p-2 text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="flex-1 py-2 rounded-md border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ backgroundColor: empresa?.color_primario || "#0284c7" }}
                className="flex-1 py-2 rounded-md text-xs font-bold text-white shadow-2xs hover:opacity-95 cursor-pointer"
              >
                Guardar Prospecto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Convertir a Ganado / Crear Orden de Taller */}
      {isGanadoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleConfirmGanado}
            className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 size={16} />
                Convertir Prospecto a Orden de Servicio
              </h2>
              <button 
                type="button" 
                onClick={() => setIsGanadoModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Registra el vehículo del cliente para generar automáticamente su orden en el Tablero de Taller.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Marca *</label>
                <input 
                  type="text" 
                  required
                  value={vehicleMarca}
                  onChange={e => setVehicleMarca(e.target.value)}
                  placeholder="Ej. Nissan"
                  className="w-full text-xs font-medium border border-slate-300 rounded-md p-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Modelo *</label>
                <input 
                  type="text" 
                  required
                  value={vehicleModelo}
                  onChange={e => setVehicleModelo(e.target.value)}
                  placeholder="Ej. Versa 2021"
                  className="w-full text-xs font-medium border border-slate-300 rounded-md p-2 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Placas</label>
                <input 
                  type="text" 
                  value={vehiclePlacas}
                  onChange={e => setVehiclePlacas(e.target.value)}
                  placeholder="Ej. RTM-492-B"
                  className="w-full text-xs font-mono font-bold uppercase border border-slate-300 rounded-md p-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kilometraje</label>
                <input 
                  type="number" 
                  value={vehicleKm}
                  onChange={e => setVehicleKm(e.target.value)}
                  placeholder="Ej. 65000"
                  className="w-full text-xs font-bold border border-slate-300 rounded-md p-2 text-slate-900"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsGanadoModalOpen(false)}
                className="flex-1 py-2 rounded-md border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Car size={14} /> Crear Orden en Taller
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
