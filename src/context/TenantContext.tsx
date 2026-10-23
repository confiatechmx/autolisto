"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { saasHqService, ImpersonationSession } from "@/services/saasHqService";
import { tenantDomainService, TenantDomainInfo } from "@/services/tenantDomainService";

export interface EmpresaConfig {
  id: string;
  nombre_comercial: string;
  rfc: string | null;
  direccion: string | null;
  tasa_iva: number;
  logo_url: string | null;
  color_primario: string;
  color_sidebar: string;
  eslogan: string | null;
  telefono: string | null;
  email_contacto: string | null;
  sitio_web: string | null;
  margen_refacciones_default: number;
  terminos_condiciones: string | null;
  plan_suscripcion?: "STARTER" | "PRO" | "ENTERPRISE" | "BASICO";
  ambiente?: "PRODUCTION" | "SANDBOX" | "DEMO";
  activo?: boolean;
  custom_metadata?: any;
}

export interface Sucursal {
  id: string;
  empresa_id: string;
  nombre: string;
  codigo: string;
  direccion: string | null;
  telefono: string | null;
  gerente: string | null;
  es_matriz: boolean;
  activa: boolean;
}

export interface UserPerfil {
  id: string;
  empresa_id: string;
  sucursal_id: string | null;
  nombre: string;
  rol: string;
  email?: string;
}

export const WHITE_LABEL_PRESETS = [
  {
    id: "shopmonkey",
    name: "Shopmonkey Blue",
    primary: "#2563EB",
    sidebar: "#0F172A",
    badge: "Estándar SaaS",
  },
  {
    id: "pirelli",
    name: "Motorsport Red",
    primary: "#DC2626",
    sidebar: "#111827",
    badge: "Llantera / Performance",
  },
  {
    id: "emerald",
    name: "Castrol Emerald",
    primary: "#059669",
    sidebar: "#091E1A",
    badge: "Servicio Mecánico",
  },
  {
    id: "gulf",
    name: "Industrial Orange",
    primary: "#EA580C",
    sidebar: "#18181B",
    badge: "Flotillas / Diesel",
  },
];

interface TenantContextValue {
  empresa: EmpresaConfig | null;
  sucursales: Sucursal[];
  sucursalActiva: Sucursal | null;
  setSucursalActivaId: (id: string | null) => void;
  perfil: UserPerfil | null;
  loadingTenant: boolean;
  refreshTenant: () => Promise<void>;
  updateBrandTheme: (updates: Partial<EmpresaConfig>) => Promise<void>;
  customDomainInfo: TenantDomainInfo | null;
  impersonation: ImpersonationSession | null;
  isSuperAdmin: boolean;
  switchEmpresa: (empresaId: string) => Promise<void>;
}

export const DEFAULT_EMPRESA: EmpresaConfig = {
  id: "a0000000-0000-0000-0000-000000000001",
  nombre_comercial: "Torque & Ruta - Centro Automotriz",
  rfc: "TRC2105148A1",
  direccion: "Av. José Vasconcelos 450 Pte, Col. Del Valle, San Pedro Garza García, N.L.",
  tasa_iva: 16,
  logo_url: null,
  color_primario: "#2563EB",
  color_sidebar: "#0F172A",
  eslogan: "Especialistas en Frenos, Suspensión, Mecánica y Llantas Multimarca",
  telefono: "81 8356 4290",
  email_contacto: "servicio@torqueyruta.mx",
  sitio_web: "www.torqueyruta.mx",
  margen_refacciones_default: 35,
  terminos_condiciones:
    "Garantía de 30 días o 1,000 km en mano de obra. Refacciones y neumáticos sujetos a garantía del fabricante.",
  plan_suscripcion: "ENTERPRISE",
  ambiente: "PRODUCTION",
  activo: true,
  custom_metadata: {},
};

const TenantContext = createContext<TenantContextValue>({
  empresa: DEFAULT_EMPRESA,
  sucursales: [],
  sucursalActiva: null,
  setSucursalActivaId: () => {},
  perfil: null,
  loadingTenant: true,
  refreshTenant: async () => {},
  updateBrandTheme: async () => {},
  customDomainInfo: null,
  impersonation: null,
  isSuperAdmin: false,
  switchEmpresa: async () => {},
});

export function applyThemeCssVariables(primaryColor: string, sidebarColor: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--color-primary", primaryColor || "#2563EB");
  root.style.setProperty("--color-ring", primaryColor || "#2563EB");
  root.style.setProperty("--color-swamp", sidebarColor || "#0F172A");
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(DEFAULT_EMPRESA);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalActivaId, setSucursalActivaIdState] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<UserPerfil | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [customDomainInfo, setCustomDomainInfo] = useState<TenantDomainInfo | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationSession | null>(() =>
    saasHqService.getImpersonationStatus()
  );

  const isSuperAdmin = perfil?.rol === "SuperAdmin" || perfil?.rol === "SUPERADMIN";

  const loadTenant = useCallback(async () => {
    setLoadingTenant(true);
    try {
      const supabase = createClient();
      const currentImpersonation = saasHqService.getImpersonationStatus();
      setImpersonation(currentImpersonation);

      const [domainInfo, { data: authData }] = await Promise.all([
        tenantDomainService.resolverTenantPorDominio().catch(() => null),
        supabase.auth.getUser().catch(() => ({ data: { user: null } })),
      ]);

      if (domainInfo) {
        setCustomDomainInfo(domainInfo);
      }

      const user = authData?.user;
      let targetEmpresaId: string | null = null;
      let userProfile: UserPerfil | null = null;

      if (user) {
        const { data: perfData } = await supabase
          .from("perfiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (perfData) {
          userProfile = {
            id: user.id,
            empresa_id: perfData.empresa_id,
            sucursal_id: perfData.sucursal_id,
            nombre: perfData.nombre || user.email || "Usuario",
            rol: perfData.rol || "Administrador",
            email: user.email,
          };
          setPerfil(userProfile);
          targetEmpresaId = perfData.empresa_id;
        }
      }

      // Si hay una sesión de impersonación activa, prevalece sobre el perfil
      if (currentImpersonation?.targetEmpresaId) {
        targetEmpresaId = currentImpersonation.targetEmpresaId;
      } else if (domainInfo?.empresa_id) {
        targetEmpresaId = domainInfo.empresa_id;
      }

      // Consultar empresa y sucursales
      let queryEmpresa = supabase.from("empresas").select("*");
      if (targetEmpresaId) {
        queryEmpresa = queryEmpresa.eq("id", targetEmpresaId);
      }
      const { data: empData } = await queryEmpresa.limit(1).maybeSingle();

      let querySucursales = supabase.from("sucursales").select("*").order("es_matriz", { ascending: false });
      if (empData?.id) {
        querySucursales = querySucursales.eq("empresa_id", empData.id);
      }
      const { data: sucData } = await querySucursales;

      if (empData) {
        const merged: EmpresaConfig = {
          ...DEFAULT_EMPRESA,
          ...empData,
          color_primario: empData.color_primario || "#2563EB",
          color_sidebar: empData.color_sidebar || "#0F172A",
          margen_refacciones_default: Number(empData.margen_refacciones_default ?? 35),
          tasa_iva: Number(empData.tasa_iva ?? 16),
          plan_suscripcion: empData.plan_suscripcion || "STARTER",
          ambiente: empData.ambiente || "PRODUCTION",
          activo: empData.activo !== false,
          custom_metadata: empData.custom_metadata || {},
        };
        setEmpresa(merged);
        applyThemeCssVariables(merged.color_primario, merged.color_sidebar);
      }

      if (sucData) {
        setSucursales(sucData as Sucursal[]);
        const savedBranch = typeof window !== "undefined" ? localStorage.getItem("autolisto_sucursal_id") : null;
        if (savedBranch && savedBranch !== "ALL" && sucData.some((s: any) => s.id === savedBranch)) {
          setSucursalActivaIdState(savedBranch);
        } else if (savedBranch === "ALL") {
          setSucursalActivaIdState(null);
        } else {
          setSucursalActivaIdState(null);
        }
      }
    } catch (err) {
      console.error("Error loading tenant:", err);
    } finally {
      setLoadingTenant(false);
    }
  }, []);

  useEffect(() => {
    loadTenant();

    const handleEmpresaChanged = () => {
      loadTenant();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("autolisto:empresa_changed", handleEmpresaChanged);
      return () => {
        window.removeEventListener("autolisto:empresa_changed", handleEmpresaChanged);
      };
    }
  }, [loadTenant]);

  const setSucursalActivaId = (id: string | null) => {
    setSucursalActivaIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("autolisto_sucursal_id", id || "ALL");
    }
  };

  const updateBrandTheme = async (updates: Partial<EmpresaConfig>) => {
    if (!empresa) return;
    const next = { ...empresa, ...updates };
    setEmpresa(next);
    applyThemeCssVariables(next.color_primario, next.color_sidebar);

    const supabase = createClient();
    await supabase
      .from("empresas")
      .update({
        nombre_comercial: next.nombre_comercial,
        rfc: next.rfc,
        direccion: next.direccion,
        tasa_iva: next.tasa_iva,
        logo_url: next.logo_url,
        color_primario: next.color_primario,
        color_sidebar: next.color_sidebar,
        eslogan: next.eslogan,
        telefono: next.telefono,
        email_contacto: next.email_contacto,
        sitio_web: next.sitio_web,
        margen_refacciones_default: next.margen_refacciones_default,
        terminos_condiciones: next.terminos_condiciones,
      })
      .eq("id", empresa.id);
  };

  const switchEmpresa = async (targetEmpresaId: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("empresas").select("*").eq("id", targetEmpresaId).maybeSingle();
    if (data) {
      const merged: EmpresaConfig = {
        ...DEFAULT_EMPRESA,
        ...data,
        color_primario: data.color_primario || "#2563EB",
        color_sidebar: data.color_sidebar || "#0F172A",
        margen_refacciones_default: Number(data.margen_refacciones_default ?? 35),
        tasa_iva: Number(data.tasa_iva ?? 16),
        plan_suscripcion: data.plan_suscripcion || "STARTER",
        ambiente: data.ambiente || "PRODUCTION",
        activo: data.activo !== false,
        custom_metadata: data.custom_metadata || {},
      };
      setEmpresa(merged);
      applyThemeCssVariables(merged.color_primario, merged.color_sidebar);

      // Cargar sucursales de esta empresa
      const { data: sucData } = await supabase
        .from("sucursales")
        .select("*")
        .eq("empresa_id", targetEmpresaId)
        .order("es_matriz", { ascending: false });

      if (sucData) {
        setSucursales(sucData as Sucursal[]);
        setSucursalActivaIdState(null);
      }
    }
  };

  const sucursalActiva = sucursales.find((s) => s.id === sucursalActivaId) || null;

  return (
    <TenantContext.Provider
      value={{
        empresa,
        sucursales,
        sucursalActiva,
        setSucursalActivaId,
        perfil,
        loadingTenant,
        refreshTenant: loadTenant,
        updateBrandTheme,
        customDomainInfo,
        impersonation,
        isSuperAdmin,
        switchEmpresa,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
