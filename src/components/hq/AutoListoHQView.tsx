"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ShieldCheck,
  Building2,
  Search,
  RefreshCw,
  Plus,
  DollarSign,
  Power,
  Globe,
  Loader2,
  LogIn,
  Activity,
  ChevronRight,
  TrendingUp,
  Wrench,
  Car,
  AlertTriangle,
  Info,
} from "lucide-react";
import { saasHqService, EmpresaHqRecord } from "@/services/saasHqService";
import { toast } from "sonner";
import ConciliarPagoModal from "./ConciliarPagoModal";
import CustomDomainModal from "./CustomDomainModal";
import SuperAdminAuditDrawer from "./SuperAdminAuditDrawer";
import TenantsManagementModal from "../auth/TenantsManagementModal";
import { useRouter } from "next/navigation";

const PLAN_MONTHLY_VALUES: Record<string, number> = {
  STARTER: 1499,
  BASICO: 1499,
  PRO: 3999,
  ENTERPRISE: 9999,
};

export default function AutoListoHQView() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<EmpresaHqRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroPlan, setFiltroPlan] = useState<string>("TODOS");
  const [filtroAmbiente, setFiltroAmbiente] = useState<string>("TODOS");
  const [filtroEstatus, setFiltroEstatus] = useState<string>("TODOS");
  const [showMrrBreakdown, setShowMrrBreakdown] = useState(false);
  const mrrCardRef = useRef<HTMLDivElement>(null);

  // Modales
  const [selectedEmpresaPago, setSelectedEmpresaPago] = useState<EmpresaHqRecord | null>(null);
  const [selectedEmpresaDomain, setSelectedEmpresaDomain] = useState<EmpresaHqRecord | null>(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [showCrearModal, setShowCrearModal] = useState(false);

  // Kill-Switch Confirm
  const [empresaParaSuspender, setEmpresaParaSuspender] = useState<EmpresaHqRecord | null>(null);
  const [motivoSuspension, setMotivoSuspension] = useState("");
  const [suspendingLoading, setSuspendingLoading] = useState(false);

  // Impersonation loading
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await saasHqService.getEmpresasWithMetrics();
      setEmpresas(list);
    } catch (e: any) {
      toast.error("Error al cargar datos del Control Plane: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const filteredEmpresas = useMemo(() => {
    return empresas.filter((emp) => {
      const matchSearch =
        emp.nombre_comercial.toLowerCase().includes(search.toLowerCase()) ||
        (emp.rfc && emp.rfc.toLowerCase().includes(search.toLowerCase())) ||
        emp.id.toLowerCase().includes(search.toLowerCase());

      const matchPlan = filtroPlan === "TODOS" || emp.plan_suscripcion === filtroPlan;
      const matchAmbiente = filtroAmbiente === "TODOS" || emp.ambiente === filtroAmbiente;
      const matchEstatus =
        filtroEstatus === "TODOS" ||
        (filtroEstatus === "ACTIVO" && emp.activo) ||
        (filtroEstatus === "SUSPENDIDO" && !emp.activo);

      return matchSearch && matchPlan && matchAmbiente && matchEstatus;
    });
  }, [empresas, search, filtroPlan, filtroAmbiente, filtroEstatus]);

  const metrics = useMemo(() => {
    const total = empresas.length;
    const activas = empresas.filter((e) => e.activo).length;
    const suspendidas = empresas.filter((e) => !e.activo).length;
    const enProduccion = empresas.filter((e) => e.ambiente === "PRODUCTION").length;
    const totalOrdenes = empresas.reduce((acc, e) => acc + (e.total_ordenes || 0), 0);
    const totalVehiculos = empresas.reduce((acc, e) => acc + (e.total_vehiculos || 0), 0);

    const breakdown = empresas
      .filter((e) => e.activo)
      .map((e) => {
        const montoReconciliado = e.custom_metadata?.suscripcion?.monto;
        const monto = montoReconciliado && montoReconciliado > 0 ? montoReconciliado : PLAN_MONTHLY_VALUES[e.plan_suscripcion] || 1499;
        return {
          id: e.id,
          nombre: e.nombre_comercial,
          plan: e.plan_suscripcion,
          monto,
          vigencia_hasta: e.custom_metadata?.suscripcion?.vigencia_hasta,
        };
      });

    const mrrTotal = breakdown.reduce((acc, item) => acc + item.monto, 0);

    return {
      total,
      activas,
      suspendidas,
      enProduccion,
      totalOrdenes,
      totalVehiculos,
      mrrTotal,
      breakdown,
    };
  }, [empresas]);

  // Kill switch handler
  const handleToggleActivoConfirm = async () => {
    if (!empresaParaSuspender) return;
    const nuevoEstado = !empresaParaSuspender.activo;

    try {
      setSuspendingLoading(true);
      await saasHqService.toggleEmpresaActivo(
        empresaParaSuspender.id,
        nuevoEstado,
        motivoSuspension.trim() || undefined
      );

      toast.success(
        nuevoEstado
          ? `Taller "${empresaParaSuspender.nombre_comercial}" reactivado exitosamente.`
          : `Kill-Switch aplicado: Taller "${empresaParaSuspender.nombre_comercial}" suspendido.`
      );

      setEmpresaParaSuspender(null);
      setMotivoSuspension("");
      await loadData();
    } catch (e: any) {
      toast.error("Error al modificar estatus de empresa: " + e.message);
    } finally {
      setSuspendingLoading(false);
    }
  };

  // Impersonation handler
  const handleIniciarImpersonacion = async (empresa: EmpresaHqRecord) => {
    try {
      setImpersonatingId(empresa.id);
      await saasHqService.iniciarImpersonacion(empresa.id, empresa.nombre_comercial);
      toast.success(`Iniciando soporte técnico para ${empresa.nombre_comercial}...`, {
        description: "Redirigiendo al espacio de trabajo del taller.",
      });
      router.push("/tablero");
    } catch (e: any) {
      toast.error("No se pudo iniciar la sesión de soporte: " + e.message);
    } finally {
      setImpersonatingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Control Plane */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0B1120] to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <ShieldCheck className="h-3.5 w-3.5" />
                Control HQ • Centro de Mando SaaS
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                v2.0 Multi-Tenant
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              AutoListo Control Plane
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Gestión centralizada de talleres mecánicos, facturación recurrente (MRR), marca blanca, asignación de dominios y modo soporte con impersonación segura.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowAuditDrawer(true)}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Activity className="h-4 w-4 text-blue-400" />
              <span>Bitácora de Auditoría</span>
            </button>

            <button
              onClick={() => setShowCrearModal(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/25"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Taller</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div
          ref={mrrCardRef}
          onClick={() => setShowMrrBreakdown(!showMrrBreakdown)}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer hover:border-slate-700 transition-all relative group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              MRR Mensual
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            ${metrics.mrrTotal.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{metrics.activas} talleres activos facturando</span>
          </div>

          {/* Desglose Popover */}
          {showMrrBreakdown && (
            <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-2 text-xs">
              <div className="font-bold text-white border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Desglose por Taller</span>
                <span className="text-[10px] text-slate-400 font-normal font-mono">{metrics.breakdown.length} total</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
                {metrics.breakdown.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-900">
                    <div>
                      <span className="font-medium text-slate-200 block truncate max-w-[140px]">{item.nombre}</span>
                      <span className="text-[9px] text-slate-500 uppercase">{item.plan}</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">${item.monto.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Talleres Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Talleres Conectados
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            {metrics.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span className="text-emerald-400 font-bold">{metrics.activas} activos</span> •{" "}
            <span className="text-rose-400 font-bold">{metrics.suspendidas} suspendidos</span>
          </div>
        </div>

        {/* Órdenes Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Órdenes de Trabajo
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            {metrics.totalOrdenes}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            En todas las bahías y rampas SaaS
          </div>
        </div>

        {/* Vehículos Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Expedientes de Autos
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            {metrics.totalVehiculos}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Historial clínico & DVI digitalizado
          </div>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por nombre, RFC o ID de empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filtroPlan}
            onChange={(e) => setFiltroPlan(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos los Planes</option>
            <option value="STARTER">Starter ($1,499)</option>
            <option value="PRO">Pro ($3,999)</option>
            <option value="ENTERPRISE">Enterprise ($9,999)</option>
          </select>

          <select
            value={filtroAmbiente}
            onChange={(e) => setFiltroAmbiente(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos los Entornos</option>
            <option value="PRODUCTION">Producción</option>
            <option value="SANDBOX">Sandbox</option>
            <option value="DEMO">Demo</option>
          </select>

          <select
            value={filtroEstatus}
            onChange={(e) => setFiltroEstatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos los Estatus</option>
            <option value="ACTIVO">Activos</option>
            <option value="SUSPENDIDO">Suspendidos</option>
          </select>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Recargar listado"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabla Principal de Talleres */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Taller / Organización</th>
                <th className="py-3 px-4">Estatus</th>
                <th className="py-3 px-4">Plan SaaS</th>
                <th className="py-3 px-4">Sucursales (Cuota)</th>
                <th className="py-3 px-4">Actividad</th>
                <th className="py-3 px-4 text-right">Acciones de Mando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    Cargando talleres registrados...
                  </td>
                </tr>
              ) : filteredEmpresas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No se encontraron talleres con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredEmpresas.map((emp) => {
                  const plan = emp.plan_suscripcion || "STARTER";
                  const isEnterprise = plan === "ENTERPRISE";
                  const isPro = plan === "PRO";

                  return (
                    <tr key={emp.id} className="hover:bg-slate-950/40 transition-colors">
                      {/* Empresa / Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            style={{ backgroundColor: emp.color_primario || "#2563EB" }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-inner"
                          >
                            {emp.nombre_comercial.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">{emp.nombre_comercial}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                              <span>RFC: {emp.rfc || "N/A"}</span>
                              <span>•</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  emp.ambiente === "PRODUCTION"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                }`}
                              >
                                {emp.ambiente}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Estatus */}
                      <td className="py-3.5 px-4">
                        {emp.activo ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Suspendido
                          </span>
                        )}
                      </td>

                      {/* Plan SaaS */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                            isEnterprise
                              ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                              : isPro
                              ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {plan} (${PLAN_MONTHLY_VALUES[plan]?.toLocaleString()})
                        </span>
                      </td>

                      {/* Cuota Sucursales */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-300">
                              {emp.sucursales_activas} / {isEnterprise ? "∞" : emp.sucursales_limite}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {isEnterprise ? "Ilimitadas" : `Max ${emp.sucursales_limite}`}
                            </span>
                          </div>
                          <div className="w-24 bg-slate-950 rounded-full h-1.5 overflow-hidden">
                            <div
                              style={{
                                width: isEnterprise
                                  ? "100%"
                                  : `${Math.min(100, (emp.sucursales_activas / emp.sucursales_limite) * 100)}%`,
                              }}
                              className={`h-full ${
                                isEnterprise
                                  ? "bg-purple-500"
                                  : emp.sucursales_activas >= emp.sucursales_limite
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                              }`}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actividad */}
                      <td className="py-3.5 px-4 text-[11px] text-slate-300 font-mono">
                        <div>{emp.total_ordenes} órdenes</div>
                        <div className="text-slate-500 text-[10px]">{emp.total_vehiculos} autos</div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Impersonar */}
                          <button
                            onClick={() => handleIniciarImpersonacion(emp)}
                            disabled={impersonatingId === emp.id}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 font-semibold text-[11px] transition-all cursor-pointer disabled:opacity-50"
                            title="Entrar al taller en modo soporte"
                          >
                            {impersonatingId === emp.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <LogIn className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">Impersonar</span>
                          </button>

                          {/* Marca Blanca / Dominio */}
                          <button
                            onClick={() => setSelectedEmpresaDomain(emp)}
                            className="p-1.5 rounded-lg border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Gestionar Dominio & Marca Blanca"
                          >
                            <Globe className="w-4 h-4" />
                          </button>

                          {/* Conciliar Pago */}
                          <button
                            onClick={() => setSelectedEmpresaPago(emp)}
                            className="p-1.5 rounded-lg border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                            title="Conciliar Pago / Extender Suscripción"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>

                          {/* Kill-Switch (Suspender / Reactivar) */}
                          <button
                            onClick={() => setEmpresaParaSuspender(emp)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              emp.activo
                                ? "border-slate-800 text-rose-400 hover:bg-rose-500/10"
                                : "border-slate-800 text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                            title={emp.activo ? "Suspender Taller (Kill-Switch)" : "Reactivar Taller"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Conciliar Pago */}
      {selectedEmpresaPago && (
        <ConciliarPagoModal
          empresa={selectedEmpresaPago}
          isOpen={!!selectedEmpresaPago}
          onClose={() => setSelectedEmpresaPago(null)}
          onSuccess={loadData}
        />
      )}

      {/* Modal Dominios Personalizados */}
      {selectedEmpresaDomain && (
        <CustomDomainModal
          isOpen={!!selectedEmpresaDomain}
          onClose={() => setSelectedEmpresaDomain(null)}
          empresaId={selectedEmpresaDomain.id}
          empresaNombre={selectedEmpresaDomain.nombre_comercial}
          onSaved={loadData}
        />
      )}

      {/* Modal Nuevo Taller */}
      {showCrearModal && (
        <TenantsManagementModal
          isOpen={showCrearModal}
          onClose={() => setShowCrearModal(false)}
          onTenantSwitched={() => {
            loadData();
            setShowCrearModal(false);
          }}
        />
      )}

      {/* Drawer de Auditoría */}
      <SuperAdminAuditDrawer
        isOpen={showAuditDrawer}
        onClose={() => setShowAuditDrawer(false)}
      />

      {/* Dialogo Confirmación Kill-Switch */}
      {empresaParaSuspender && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  empresaParaSuspender.activo
                    ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                    : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {empresaParaSuspender.activo ? "¿Suspender Taller?" : "¿Reactivar Taller?"}
                </h3>
                <p className="text-xs text-slate-400">{empresaParaSuspender.nombre_comercial}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {empresaParaSuspender.activo
                ? "Al suspender este taller, sus usuarios verán la pantalla de pago pendiente. Todas sus órdenes, clientes y vehículos permanecerán 100% resguardados."
                : "Al reactivar este taller, los usuarios recuperarán acceso inmediato a su tablero y catálogo de operaciones."}
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Motivo / Justificación Administrativa
              </label>
              <input
                type="text"
                placeholder={
                  empresaParaSuspender.activo
                    ? "Ej. Falta de pago mensualidad de octubre"
                    : "Ej. Pago confirmado por transferencia"
                }
                value={motivoSuspension}
                onChange={(e) => setMotivoSuspension(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEmpresaParaSuspender(null)}
                className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleToggleActivoConfirm}
                disabled={suspendingLoading}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  empresaParaSuspender.activo
                    ? "bg-rose-600 hover:bg-rose-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {suspendingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{empresaParaSuspender.activo ? "Confirmar Suspensión" : "Confirmar Reactivación"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
