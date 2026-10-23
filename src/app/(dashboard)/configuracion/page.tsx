"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  useTenant,
  WHITE_LABEL_PRESETS,
  applyThemeCssVariables,
} from "@/context/TenantContext";
import {
  Loader2,
  Settings,
  Building2,
  Landmark,
  CheckCircle2,
  Users,
  Plus,
  Pencil,
  Shield,
  UserCog,
  Wrench,
  Palette,
  Sparkles,
  MapPin,
  Phone,
  Check,
} from "lucide-react";

type ConfigTab = "WhiteLabel" | "Sucursales" | "Personal" | "Pagos";

const AVATAR_COLORS = [
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#DC2626",
  "#0891B2",
  "#0F172A",
];

export default function ConfiguracionPage() {
  const supabase = createClient();
  const {
    empresa: tenantEmpresa,
    sucursales,
    sucursalActiva,
    setSucursalActivaId,
    refreshTenant,
    updateBrandTheme,
  } = useTenant();

  const [activeTab, setActiveTab] = useState<ConfigTab>("WhiteLabel");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Tab 1: White-Label & Perfil State
  const [formEmpresa, setFormEmpresa] = useState({
    nombre_comercial: "",
    eslogan: "",
    rfc: "",
    telefono: "",
    email_contacto: "",
    sitio_web: "",
    direccion: "",
    tasa_iva: 16,
    margen_refacciones_default: 35,
    terminos_condiciones: "",
    logo_url: "",
    color_primario: "#2563EB",
    color_sidebar: "#0F172A",
  });

  // Tab 2: Sucursales CRUD Modal State
  const [isSucursalModalOpen, setIsSucursalModalOpen] = useState(false);
  const [editingSucursalId, setEditingSucursalId] = useState<string | null>(
    null
  );
  const [sucursalForm, setSucursalForm] = useState({
    nombre: "",
    codigo: "",
    direccion: "",
    telefono: "",
    gerente: "",
    es_matriz: false,
    activa: true,
  });
  const [savingSucursal, setSavingSucursal] = useState(false);

  // Tab 3: Equipo, Técnicos y Comisiones State
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [isEmpleadoModalOpen, setIsEmpleadoModalOpen] = useState(false);
  const [editingEmpleadoId, setEditingEmpleadoId] = useState<string | null>(
    null
  );
  const [empleadoForm, setEmpleadoForm] = useState({
    nombre: "",
    rol: "Mecánico" as "Mecánico" | "Vendedor" | "Administrador",
    puesto: "Técnico Mecánico",
    especialidad: "",
    telefono: "",
    sucursal_id: "",
    comision_porcentaje: 25,
    tarifa_hora: 450,
    color_avatar: "#2563EB",
    activo: true,
  });
  const [savingEmpleado, setSavingEmpleado] = useState(false);

  // Tab 4: Métodos de Pago
  const [pagosConfig, setPagosConfig] = useState<any[]>([]);

  const loadConfigData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: empData }, { data: pagosData }, { data: staffData }] =
        await Promise.all([
          supabase.from("empresas").select("*").limit(1).maybeSingle(),
          supabase
            .from("configuracion_pagos")
            .select("*")
            .order("proveedor", { ascending: true }),
          supabase
            .from("empleados")
            .select("*, sucursales(nombre, codigo)")
            .order("rol")
            .order("nombre"),
        ]);

      const sourceEmp = empData || tenantEmpresa;
      if (sourceEmp) {
        setFormEmpresa({
          nombre_comercial: sourceEmp.nombre_comercial || "",
          eslogan: sourceEmp.eslogan || "",
          rfc: sourceEmp.rfc || "",
          telefono: sourceEmp.telefono || "",
          email_contacto: sourceEmp.email_contacto || "",
          sitio_web: sourceEmp.sitio_web || "",
          direccion: sourceEmp.direccion || "",
          tasa_iva: Number(sourceEmp.tasa_iva ?? 16),
          margen_refacciones_default: Number(
            sourceEmp.margen_refacciones_default ?? 35
          ),
          terminos_condiciones: sourceEmp.terminos_condiciones || "",
          logo_url: sourceEmp.logo_url || "",
          color_primario: sourceEmp.color_primario || "#2563EB",
          color_sidebar: sourceEmp.color_sidebar || "#0F172A",
        });
      }

      if (pagosData) setPagosConfig(pagosData);
      if (staffData) setEmpleados(staffData);
    } catch (error) {
      console.error("Error loading configuration:", error);
    } finally {
      setLoading(false);
    }
  }, [tenantEmpresa]);

  useEffect(() => {
    loadConfigData();
  }, [loadConfigData]);

  // --- Tab 1 & Tab 4 Global Save ---
  const handlePresetClick = (primary: string, sidebar: string) => {
    setFormEmpresa((prev) => ({
      ...prev,
      color_primario: primary,
      color_sidebar: sidebar,
    }));
    applyThemeCssVariables(primary, sidebar);
  };

  const handleSaveGlobalConfig = async () => {
    setSaving(true);
    setSaveMessage("");
    try {
      await updateBrandTheme({
        nombre_comercial: formEmpresa.nombre_comercial,
        eslogan: formEmpresa.eslogan || null,
        rfc: formEmpresa.rfc || null,
        telefono: formEmpresa.telefono || null,
        email_contacto: formEmpresa.email_contacto || null,
        sitio_web: formEmpresa.sitio_web || null,
        direccion: formEmpresa.direccion || null,
        tasa_iva: Number(formEmpresa.tasa_iva || 16),
        margen_refacciones_default: Number(
          formEmpresa.margen_refacciones_default || 35
        ),
        terminos_condiciones: formEmpresa.terminos_condiciones || null,
        logo_url: formEmpresa.logo_url || null,
        color_primario: formEmpresa.color_primario,
        color_sidebar: formEmpresa.color_sidebar,
      });

      if (pagosConfig.length > 0) {
        for (const p of pagosConfig) {
          await supabase
            .from("configuracion_pagos")
            .update({
              comision_porcentaje: Number(p.comision_porcentaje || 0),
              activo: Boolean(p.activo),
            })
            .eq("id", p.id);
        }
      }

      await refreshTenant();
      setSaveMessage("Configuración y tema White-Label guardados en vivo.");
      setTimeout(() => setSaveMessage(""), 3500);
    } catch (err) {
      console.error("Error guardando configuración:", err);
    } finally {
      setSaving(false);
    }
  };

  // --- Tab 2: Sucursales CRUD ---
  const openSucursalModal = (suc?: any) => {
    if (suc) {
      setEditingSucursalId(suc.id);
      setSucursalForm({
        nombre: suc.nombre || "",
        codigo: suc.codigo || "",
        direccion: suc.direccion || "",
        telefono: suc.telefono || "",
        gerente: suc.gerente || "",
        es_matriz: Boolean(suc.es_matriz),
        activa: suc.activa !== false,
      });
    } else {
      setEditingSucursalId(null);
      setSucursalForm({
        nombre: "",
        codigo: `MTY-0${sucursales.length + 1}`,
        direccion: "",
        telefono: "",
        gerente: "",
        es_matriz: false,
        activa: true,
      });
    }
    setIsSucursalModalOpen(true);
  };

  const handleSaveSucursal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSucursal(true);
    try {
      const payload = {
        empresa_id:
          tenantEmpresa?.id || "a0000000-0000-0000-0000-000000000001",
        nombre: sucursalForm.nombre.trim(),
        codigo: sucursalForm.codigo.trim().toUpperCase(),
        direccion: sucursalForm.direccion.trim() || null,
        telefono: sucursalForm.telefono.trim() || null,
        gerente: sucursalForm.gerente.trim() || null,
        es_matriz: sucursalForm.es_matriz,
        activa: sucursalForm.activa,
      };

      if (editingSucursalId) {
        await supabase
          .from("sucursales")
          .update(payload)
          .eq("id", editingSucursalId);
      } else {
        await supabase.from("sucursales").insert(payload);
      }

      await refreshTenant();
      setIsSucursalModalOpen(false);
    } catch (err) {
      console.error("Error guardando sucursal:", err);
    } finally {
      setSavingSucursal(false);
    }
  };

  // --- Tab 3: Empleados CRUD ---
  const openEmpleadoModal = (emp?: any) => {
    if (emp) {
      setEditingEmpleadoId(emp.id);
      setEmpleadoForm({
        nombre: emp.nombre || "",
        rol: emp.rol || "Mecánico",
        puesto: emp.puesto || emp.rol || "Técnico Mecánico",
        especialidad: emp.especialidad || "",
        telefono: emp.telefono || "",
        sucursal_id: emp.sucursal_id || sucursales[0]?.id || "",
        comision_porcentaje: Number(emp.comision_porcentaje ?? 25),
        tarifa_hora: Number(emp.tarifa_hora ?? 450),
        color_avatar: emp.color_avatar || "#2563EB",
        activo: emp.activo !== false,
      });
    } else {
      setEditingEmpleadoId(null);
      setEmpleadoForm({
        nombre: "",
        rol: "Mecánico",
        puesto: "Maestro Técnico",
        especialidad: "Mecánica General y Frenos",
        telefono: "",
        sucursal_id:
          sucursalActiva?.id ||
          sucursales[0]?.id ||
          "b0000000-0000-0000-0000-000000000001",
        comision_porcentaje: 25,
        tarifa_hora: 450,
        color_avatar:
          AVATAR_COLORS[empleados.length % AVATAR_COLORS.length] || "#2563EB",
        activo: true,
      });
    }
    setIsEmpleadoModalOpen(true);
  };

  const handleSaveEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmpleado(true);
    try {
      const payload = {
        empresa_id:
          tenantEmpresa?.id || "a0000000-0000-0000-0000-000000000001",
        sucursal_id:
          empleadoForm.sucursal_id ||
          sucursales[0]?.id ||
          "b0000000-0000-0000-0000-000000000001",
        nombre: empleadoForm.nombre.trim(),
        rol: empleadoForm.rol,
        puesto: empleadoForm.puesto.trim() || empleadoForm.rol,
        especialidad: empleadoForm.especialidad.trim() || null,
        telefono: empleadoForm.telefono.trim() || null,
        comision_porcentaje: Number(empleadoForm.comision_porcentaje || 0),
        tarifa_hora: Number(empleadoForm.tarifa_hora || 0),
        color_avatar: empleadoForm.color_avatar,
        activo: empleadoForm.activo,
      };

      if (editingEmpleadoId) {
        await supabase
          .from("empleados")
          .update(payload)
          .eq("id", editingEmpleadoId);
      } else {
        await supabase.from("empleados").insert(payload);
      }

      const { data: staffData } = await supabase
        .from("empleados")
        .select("*, sucursales(nombre, codigo)")
        .order("rol")
        .order("nombre");
      if (staffData) setEmpleados(staffData);

      setIsEmpleadoModalOpen(false);
    } catch (err) {
      console.error("Error guardando empleado:", err);
    } finally {
      setSavingEmpleado(false);
    }
  };

  const handlePagoChange = (
    id: string,
    field: string,
    value: string | number | boolean
  ) => {
    setPagosConfig((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const inputClasses =
    "w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all bg-white text-slate-900";

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Top Header & Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs">
        <header className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Settings size={24} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Configuración White-Label y Multi-Sucursal
              </h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium">
                Personalización de marca SaaS, sucursales, comisiones de técnicos y pasarelas de pago
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className="text-xs md:text-sm font-bold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle2 size={15} /> {saveMessage}
              </span>
            )}

            {activeTab === "Sucursales" ? (
              <button
                onClick={() => openSucursalModal()}
                className="bg-primary hover:opacity-95 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-sm flex items-center gap-1.5"
              >
                <Plus size={16} /> Nueva Sucursal
              </button>
            ) : activeTab === "Personal" ? (
              <button
                onClick={() => openEmpleadoModal()}
                className="bg-primary hover:opacity-95 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-sm flex items-center gap-1.5"
              >
                <Plus size={16} /> Nuevo Integrante
              </button>
            ) : (
              <button
                onClick={handleSaveGlobalConfig}
                disabled={saving}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                Guardar Cambios en Vivo
              </button>
            )}
          </div>
        </header>

        <nav className="flex items-center px-6 gap-6 max-w-[1440px] mx-auto w-full overflow-x-auto">
          <button
            onClick={() => setActiveTab("WhiteLabel")}
            className={`pb-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "WhiteLabel"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Palette size={16} />
            1. White-Label y Perfil del Taller
          </button>
          <button
            onClick={() => setActiveTab("Sucursales")}
            className={`pb-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "Sucursales"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 size={16} />
            2. Sucursales ({sucursales.length})
          </button>
          <button
            onClick={() => setActiveTab("Personal")}
            className={`pb-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "Personal"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users size={16} />
            3. Equipo, Técnicos y Comisiones ({empleados.length})
          </button>
          <button
            onClick={() => setActiveTab("Pagos")}
            className={`pb-3.5 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "Pagos"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Landmark size={16} />
            4. Métodos de Pago y Comisiones
          </button>
        </nav>
      </div>

      <main className="flex-1 w-full">
        {/* ========================================================= */}
        {/* TAB 1: WHITE-LABEL Y PERFIL DEL TALLER                    */}
        {/* ========================================================= */}
        {activeTab === "WhiteLabel" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Brand Theme Customizer & Live Preview (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col gap-5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Palette size={16} className="text-primary" />
                    Personalización White-Label (Temas en Vivo)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Adapta la plataforma a la identidad visual de cualquier taller, llantera o centro automotriz en segundos.
                  </p>
                </div>

                {/* 4 Presets */}
                <div className="grid grid-cols-2 gap-3">
                  {WHITE_LABEL_PRESETS.map((preset) => {
                    const isSelected =
                      formEmpresa.color_primario.toLowerCase() ===
                      preset.primary.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          handlePresetClick(preset.primary, preset.sidebar)
                        }
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/20 bg-slate-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-5 h-5 rounded-full border border-black/10"
                              style={{ backgroundColor: preset.primary }}
                            />
                            <span
                              className="w-5 h-5 rounded-full border border-black/10"
                              style={{ backgroundColor: preset.sidebar }}
                            />
                          </div>
                          {isSelected && (
                            <Check size={14} className="text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {preset.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-semibold">
                            {preset.badge}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Pickers */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                      Color Primario (Botones)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formEmpresa.color_primario}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormEmpresa({
                            ...formEmpresa,
                            color_primario: val,
                          });
                          applyThemeCssVariables(val, formEmpresa.color_sidebar);
                        }}
                        className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formEmpresa.color_primario}
                        onChange={(e) =>
                          setFormEmpresa({
                            ...formEmpresa,
                            color_primario: e.target.value,
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                      Color Menú Lateral (Sidebar)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formEmpresa.color_sidebar}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormEmpresa({
                            ...formEmpresa,
                            color_sidebar: val,
                          });
                          applyThemeCssVariables(
                            formEmpresa.color_primario,
                            val
                          );
                        }}
                        className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formEmpresa.color_sidebar}
                        onChange={(e) =>
                          setFormEmpresa({
                            ...formEmpresa,
                            color_sidebar: e.target.value,
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold uppercase"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    URL del Logotipo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formEmpresa.logo_url}
                    onChange={(e) =>
                      setFormEmpresa({
                        ...formEmpresa,
                        logo_url: e.target.value,
                      })
                    }
                    placeholder="https://ejemplo.com/logo-taller.png"
                    className={inputClasses}
                  />
                </div>

                {/* Live Mini Preview */}
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div
                    className="p-4 text-white flex items-center justify-between"
                    style={{ backgroundColor: formEmpresa.color_sidebar }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white"
                        style={{ backgroundColor: formEmpresa.color_primario }}
                      >
                        {formEmpresa.nombre_comercial
                          .slice(0, 2)
                          .toUpperCase() || "TR"}
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight">
                          {formEmpresa.nombre_comercial || "Nombre del Taller"}
                        </p>
                        <p className="text-[10px] text-white/70">
                          Vista previa del Portal Digital y Menú
                        </p>
                      </div>
                    </div>
                    <span
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                      style={{ backgroundColor: formEmpresa.color_primario }}
                    >
                      Aprobar Presupuesto
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Datos Fiscales, Operativos y Garantías (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col gap-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 size={16} className="text-primary" />
                Perfil Operativo, Márgenes de Refacciones y Garantías
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Nombre Comercial del Taller
                  </label>
                  <input
                    type="text"
                    value={formEmpresa.nombre_comercial}
                    onChange={(e) =>
                      setFormEmpresa({
                        ...formEmpresa,
                        nombre_comercial: e.target.value,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Eslogan / Especialidad Comercial
                  </label>
                  <input
                    type="text"
                    value={formEmpresa.eslogan}
                    onChange={(e) =>
                      setFormEmpresa({
                        ...formEmpresa,
                        eslogan: e.target.value,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    RFC Fiscal
                  </label>
                  <input
                    type="text"
                    value={formEmpresa.rfc}
                    onChange={(e) =>
                      setFormEmpresa({ ...formEmpresa, rfc: e.target.value })
                    }
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Teléfono Principal
                  </label>
                  <input
                    type="text"
                    value={formEmpresa.telefono}
                    onChange={(e) =>
                      setFormEmpresa({
                        ...formEmpresa,
                        telefono: e.target.value,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Correo de Contacto
                  </label>
                  <input
                    type="email"
                    value={formEmpresa.email_contacto}
                    onChange={(e) =>
                      setFormEmpresa({
                        ...formEmpresa,
                        email_contacto: e.target.value,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Sitio Web
                  </label>
                  <input
                    type="text"
                    value={formEmpresa.sitio_web}
                    onChange={(e) =>
                      setFormEmpresa({
                        ...formEmpresa,
                        sitio_web: e.target.value,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Tasa de IVA (%)
                  </label>
                  <input
                    type="number"
                    value={formEmpresa.tasa_iva}
                    onChange={(e) =>
                      setFormEmpresa({
                        ...formEmpresa,
                        tasa_iva: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Margen Default Refacciones (%)
                  </label>
                  <input
                    type="number"
                    value={formEmpresa.margen_refacciones_default}
                    onChange={(e) =>
                      setFormEmpresa({
                        ...formEmpresa,
                        margen_refacciones_default:
                          parseFloat(e.target.value) || 0,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Dirección Fiscal / Matriz
                </label>
                <input
                  type="text"
                  value={formEmpresa.direccion}
                  onChange={(e) =>
                    setFormEmpresa({
                      ...formEmpresa,
                      direccion: e.target.value,
                    })
                  }
                  className={inputClasses}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Términos, Condiciones y Póliza de Garantía (Impresos en Orden y Portal)
                </label>
                <textarea
                  rows={3}
                  value={formEmpresa.terminos_condiciones}
                  onChange={(e) =>
                    setFormEmpresa({
                      ...formEmpresa,
                      terminos_condiciones: e.target.value,
                    })
                  }
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: SUCURSALES (MULTI-SUCURSAL)                        */}
        {/* ========================================================= */}
        {activeTab === "Sucursales" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sucursales.map((s) => {
                const isCurrentActive = sucursalActiva?.id === s.id;
                return (
                  <div
                    key={s.id}
                    className={`bg-white rounded-xl p-6 border shadow-xs flex flex-col justify-between gap-4 transition-all ${
                      isCurrentActive
                        ? "border-primary ring-2 ring-primary/15"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-900 text-white">
                            {s.codigo}
                          </span>
                          {s.es_matriz && (
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Sucursal Matriz
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              s.activa
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {s.activa ? "Operando" : "Inactiva"}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mt-2">
                          {s.nombre}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          {s.direccion || "Sin dirección registrada"}
                        </p>
                        <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                          <Phone size={13} className="text-slate-400 shrink-0" />
                          {s.telefono || "Sin teléfono"} • Gerente:{" "}
                          <strong className="text-slate-800">
                            {s.gerente || "No asignado"}
                          </strong>
                        </p>
                      </div>

                      <button
                        onClick={() => openSucursalModal(s)}
                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                        title="Editar Sucursal"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      {isCurrentActive ? (
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <CheckCircle2 size={15} /> Sucursal Activa en Sesión
                        </span>
                      ) : (
                        <button
                          onClick={() => setSucursalActivaId(s.id)}
                          className="text-xs font-bold text-slate-700 hover:text-primary underline"
                        >
                          Filtrar sistema por esta sucursal →
                        </button>
                      )}

                      {isCurrentActive && (
                        <button
                          onClick={() => setSucursalActivaId(null)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Ver Todas las Sucursales
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: EQUIPO, TÉCNICOS Y COMISIONES                      */}
        {/* ========================================================= */}
        {activeTab === "Personal" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Integrante / Especialidad</th>
                    <th className="py-3.5 px-5">Puesto / Rol</th>
                    <th className="py-3.5 px-5">Sucursal</th>
                    <th className="py-3.5 px-5 text-center">% Comisión MO</th>
                    <th className="py-3.5 px-5 text-right">Tarifa Hora</th>
                    <th className="py-3.5 px-5 text-center">Estatus</th>
                    <th className="py-3.5 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {empleados.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl text-white font-bold text-xs flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: emp.color_avatar || "#2563EB",
                            }}
                          >
                            {emp.nombre
                              .split(" ")
                              .map((n: string) => n[0])
                              .slice(0, 2)
                              .join("")}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">
                              {emp.nombre}
                            </p>
                            <p className="text-xs text-slate-500">
                              {emp.especialidad || emp.telefono || "General"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-bold text-slate-800 block">
                          {emp.puesto || emp.rol}
                        </span>
                        <span className="text-xs text-slate-400">
                          Rol Sistema: {emp.rol}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-xs font-bold text-slate-700">
                        {emp.sucursales
                          ? `${emp.sucursales.codigo} • ${emp.sucursales.nombre}`
                          : "Todas"}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {Number(emp.comision_porcentaje || 0)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-slate-800 tabular-nums">
                        ${Number(emp.tarifa_hora || 0).toLocaleString("es-MX")}/hr
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                            emp.activo
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {emp.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => openEmpleadoModal(emp)}
                          className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: MÉTODOS DE PAGO Y COMISIONES BANCARIAS             */}
        {/* ========================================================= */}
        {activeTab === "Pagos" && (
          <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Métodos de Pago y Comisiones de Terminal (TPV)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Define el porcentaje de comisión bancaria que retiene cada pasarela para calcular automáticamente el ingreso neto en el Corte de Caja.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {pagosConfig.map((p) => (
                <div
                  key={p.id}
                  className="p-5 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <input
                      type="checkbox"
                      checked={Boolean(p.activo)}
                      onChange={(e) =>
                        handlePagoChange(p.id, "activo", e.target.checked)
                      }
                      className="w-5 h-5 rounded border-slate-300 text-primary cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-sm ${
                            p.activo
                              ? "text-slate-900"
                              : "text-slate-400 line-through"
                          }`}
                        >
                          {p.proveedor}
                        </span>
                        {p.proveedor === "KueskiPay" && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            BNPL Quincenas
                          </span>
                        )}
                        {p.proveedor === "Atrato" && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            BNPL Meses sin Tarjeta
                          </span>
                        )}
                        {p.proveedor === "Stripe" && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Tarjetas Visa / MC / Amex
                          </span>
                        )}
                        {p.proveedor === "Mercado Pago" && (
                          <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            TPV Point Smart & Link
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Disponible en Ventanilla de Caja y Expediente Operativo
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Comisión Pasarela:
                    </span>
                    <div className="flex items-center w-28">
                      <input
                        type="number"
                        step="0.1"
                        value={p.comision_porcentaje}
                        disabled={!p.activo}
                        onChange={(e) =>
                          handlePagoChange(
                            p.id,
                            "comision_porcentaje",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full border border-slate-200 rounded-l-lg p-2 text-sm font-bold text-right"
                      />
                      <span className="bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg p-2 text-xs font-bold text-slate-600">
                        %
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL CRUD: SUCURSAL                                      */}
      {/* ========================================================= */}
      {isSucursalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">
                {editingSucursalId ? "Editar Sucursal" : "Nueva Sucursal"}
              </h3>
              <button
                onClick={() => setIsSucursalModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSaveSucursal}
              className="p-6 flex flex-col gap-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    required
                    value={sucursalForm.codigo}
                    onChange={(e) =>
                      setSucursalForm({
                        ...sucursalForm,
                        codigo: e.target.value,
                      })
                    }
                    placeholder="MTY-03"
                    className={inputClasses}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Nombre de Sucursal
                  </label>
                  <input
                    type="text"
                    required
                    value={sucursalForm.nombre}
                    onChange={(e) =>
                      setSucursalForm({
                        ...sucursalForm,
                        nombre: e.target.value,
                      })
                    }
                    placeholder="Sucursal Cumbres"
                    className={inputClasses}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Dirección Completa
                </label>
                <input
                  type="text"
                  value={sucursalForm.direccion}
                  onChange={(e) =>
                    setSucursalForm({
                      ...sucursalForm,
                      direccion: e.target.value,
                    })
                  }
                  className={inputClasses}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={sucursalForm.telefono}
                    onChange={(e) =>
                      setSucursalForm({
                        ...sucursalForm,
                        telefono: e.target.value,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Gerente / Encargado
                  </label>
                  <input
                    type="text"
                    value={sucursalForm.gerente}
                    onChange={(e) =>
                      setSucursalForm({
                        ...sucursalForm,
                        gerente: e.target.value,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sucursalForm.es_matriz}
                    onChange={(e) =>
                      setSucursalForm({
                        ...sucursalForm,
                        es_matriz: e.target.checked,
                      })
                    }
                  />
                  Es Matriz Principal
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sucursalForm.activa}
                    onChange={(e) =>
                      setSucursalForm({
                        ...sucursalForm,
                        activa: e.target.checked,
                      })
                    }
                  />
                  Sucursal Activa
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSucursalModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSucursal}
                  className="bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-bold"
                >
                  {savingSucursal ? "Guardando..." : "Guardar Sucursal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CRUD: EMPLEADO / TÉCNICO                            */}
      {/* ========================================================= */}
      {isEmpleadoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">
                {editingEmpleadoId ? "Editar Integrante" : "Nuevo Integrante del Equipo"}
              </h3>
              <button
                onClick={() => setIsEmpleadoModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSaveEmpleado}
              className="p-6 flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={empleadoForm.nombre}
                    onChange={(e) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        nombre: e.target.value,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Sucursal Asignada
                  </label>
                  <select
                    value={empleadoForm.sucursal_id}
                    onChange={(e) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        sucursal_id: e.target.value,
                      })
                    }
                    className={inputClasses}
                  >
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.codigo} - {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Rol Operativo
                  </label>
                  <select
                    value={empleadoForm.rol}
                    onChange={(e) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        rol: e.target.value as
                          | "Mecánico"
                          | "Vendedor"
                          | "Administrador",
                      })
                    }
                    className={inputClasses}
                  >
                    <option value="Mecánico">Mecánico / Técnico</option>
                    <option value="Vendedor">Asesor de Servicio / Ventas</option>
                    <option value="Administrador">Administrador / Gerente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Título del Puesto
                  </label>
                  <input
                    type="text"
                    value={empleadoForm.puesto}
                    onChange={(e) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        puesto: e.target.value,
                      })
                    }
                    placeholder="Ej. Maestro Técnico / Asesor"
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Especialidad Técnica
                  </label>
                  <input
                    type="text"
                    value={empleadoForm.especialidad}
                    onChange={(e) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        especialidad: e.target.value,
                      })
                    }
                    placeholder="Ej. Frenos, Suspensión y Diagnóstico"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={empleadoForm.telefono}
                    onChange={(e) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        telefono: e.target.value,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    % Comisión Mano de Obra
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={empleadoForm.comision_porcentaje}
                    onChange={(e) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        comision_porcentaje: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Tarifa por Hora ($ MXN)
                  </label>
                  <input
                    type="number"
                    step="10"
                    value={empleadoForm.tarifa_hora}
                    onChange={(e) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        tarifa_hora: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Color Avatar:
                  </span>
                  {AVATAR_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() =>
                        setEmpleadoForm({ ...empleadoForm, color_avatar: c })
                      }
                      className={`w-6 h-6 rounded-full border-2 ${
                        empleadoForm.color_avatar === c
                          ? "border-slate-900 scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empleadoForm.activo}
                    onChange={(e) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        activo: e.target.checked,
                      })
                    }
                  />
                  Activo
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEmpleadoModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEmpleado}
                  className="bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-bold"
                >
                  {savingEmpleado ? "Guardando..." : "Guardar Integrante"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
