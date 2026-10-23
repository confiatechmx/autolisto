"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  X,
  ArrowRight,
  Loader2,
  Search,
} from "lucide-react";
import { saasHqService, EmpresaHqRecord } from "@/services/saasHqService";
import { useTenant } from "@/context/TenantContext";
import { toast } from "sonner";

interface TenantsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTenantSwitched?: (tenantId: string) => void;
}

export default function TenantsManagementModal({
  isOpen,
  onClose,
  onTenantSwitched,
}: TenantsManagementModalProps) {
  const { empresa, switchEmpresa } = useTenant();
  const [empresas, setEmpresas] = useState<EmpresaHqRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"LISTA" | "CREAR">("LISTA");

  // Form State
  const [nombreComercial, setNombreComercial] = useState("");
  const [rfc, setRfc] = useState("");
  const [ambiente, setAmbiente] = useState<"PRODUCTION" | "SANDBOX" | "DEMO">("SANDBOX");
  const [plan, setPlan] = useState<"STARTER" | "PRO" | "ENTERPRISE">("STARTER");
  const [saving, setSaving] = useState(false);

  const activeEmpresaId = empresa?.id;

  const loadEmpresas = async () => {
    setLoading(true);
    try {
      const list = await saasHqService.getEmpresasWithMetrics();
      setEmpresas(list);
    } catch (e: any) {
      toast.error("Error al cargar lista de talleres");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEmpresas();
      setTab("LISTA");
      setNombreComercial("");
      setRfc("");
      setAmbiente("SANDBOX");
      setPlan("STARTER");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitch = async (targetId: string) => {
    if (targetId === activeEmpresaId) {
      toast.info("Ya te encuentras en este taller.");
      return;
    }

    try {
      await switchEmpresa(targetId);
      const target = empresas.find((e) => e.id === targetId);
      toast.success(`Entorno conmutado a "${target?.nombre_comercial}"`);
      if (onTenantSwitched) onTenantSwitched(targetId);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar de taller");
    }
  };

  const handleCrearEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreComercial.trim()) {
      toast.error("El nombre del taller es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const nuevo = await saasHqService.crearEmpresa({
        nombre_comercial: nombreComercial,
        rfc: rfc || (ambiente === "SANDBOX" ? "XAXX010101000" : undefined),
        ambiente,
        plan_suscripcion: plan,
      });

      toast.success(`Taller "${nuevo.nombre_comercial}" creado exitosamente`);
      await loadEmpresas();

      await switchEmpresa(nuevo.id);
      if (onTenantSwitched) onTenantSwitched(nuevo.id);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al crear el taller");
    } finally {
      setSaving(false);
    }
  };

  const filtered = empresas.filter((e) =>
    e.nombre_comercial.toLowerCase().includes(search.toLowerCase()) ||
    (e.rfc && e.rfc.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Directorio Multi-Taller (SaaS)</h3>
              <p className="text-xs text-slate-400">Control de organizaciones mecánicas y entornos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-4 border-b border-slate-800 flex gap-4 text-xs font-semibold">
          <button
            onClick={() => setTab("LISTA")}
            className={`pb-3 border-b-2 transition-all cursor-pointer ${
              tab === "LISTA"
                ? "border-blue-500 text-blue-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Talleres Registrados ({empresas.length})
          </button>
          <button
            onClick={() => setTab("CREAR")}
            className={`pb-3 border-b-2 transition-all cursor-pointer ${
              tab === "CREAR"
                ? "border-blue-500 text-blue-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Dar de Alta Nuevo Taller
          </button>
        </div>

        {/* Tab 1: LISTA */}
        {tab === "LISTA" && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
            {/* Search input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por nombre o RFC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                Cargando talleres...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 text-slate-400">
                No se encontraron organizaciones registradas.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((emp) => {
                  const isCurrent = emp.id === activeEmpresaId;
                  return (
                    <div
                      key={emp.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isCurrent
                          ? "bg-blue-950/30 border-blue-500/50"
                          : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          style={{ backgroundColor: emp.color_primario || "#2563EB" }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
                        >
                          {emp.nombre_comercial.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{emp.nombre_comercial}</span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                <CheckCircle2 className="w-3 h-3" /> Taller Activo
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                            <span>RFC: {emp.rfc || "N/A"}</span>
                            <span>•</span>
                            <span>Plan {emp.plan_suscripcion}</span>
                            <span>•</span>
                            <span className="text-slate-500">{emp.ambiente}</span>
                          </div>
                        </div>
                      </div>

                      {!isCurrent ? (
                        <button
                          onClick={() => handleSwitch(emp.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Entrar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-xs text-blue-400 font-semibold px-2">En sesión</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: CREAR */}
        {tab === "CREAR" && (
          <form onSubmit={handleCrearEmpresa} className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                Nombre Comercial del Taller *
              </label>
              <input
                type="text"
                placeholder="Ej. Taller Mecánico San Pedro"
                value={nombreComercial}
                onChange={(e) => setNombreComercial(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                RFC Fiscal (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. TMS2108159A1"
                value={rfc}
                onChange={(e) => setRfc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                  Entorno / Ambiente
                </label>
                <select
                  value={ambiente}
                  onChange={(e) => setAmbiente(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="PRODUCTION">Producción (Real)</option>
                  <option value="SANDBOX">Sandbox (Pruebas)</option>
                  <option value="DEMO">Demo</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                  Plan SaaS Inicial
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="STARTER">Starter ($1,499/mes • 1 Sucursal)</option>
                  <option value="PRO">Pro ($3,999/mes • 3 Sucursales)</option>
                  <option value="ENTERPRISE">Enterprise ($9,999/mes • Ilimitado)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTab("LISTA")}
                className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                Volver a la lista
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Crear y Conmutar</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
