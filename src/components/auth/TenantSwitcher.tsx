"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  ShieldCheck,
  Search,
  ExternalLink,
} from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import TenantsManagementModal from "./TenantsManagementModal";
import Link from "next/link";

interface TenantSwitcherProps {
  collapsed?: boolean;
}

export default function TenantSwitcher({ collapsed = false }: TenantSwitcherProps) {
  const { empresa, isSuperAdmin, switchEmpresa } = useTenant();
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadEmpresas = async () => {
    if (!isSuperAdmin) return;
    try {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("empresas")
        .select("id, nombre_comercial, ambiente, plan_suscripcion, logo_url, color_primario, activo")
        .order("nombre_comercial", { ascending: true });
      if (data) setEmpresas(data);
    } catch (e) {
      console.warn("Error cargando empresas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadEmpresas();
    }
  }, [isSuperAdmin, empresa?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectEmpresa = async (targetId: string) => {
    if (targetId === empresa?.id) {
      setOpen(false);
      return;
    }

    try {
      await switchEmpresa(targetId);
      const target = empresas.find((e) => e.id === targetId);
      toast.success(`Cambiando a "${target?.nombre_comercial || "Taller"}"`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar de taller");
    }
  };

  const filtered = empresas.filter((e) =>
    e.nombre_comercial.toLowerCase().includes(search.toLowerCase())
  );

  const brandName = empresa?.nombre_comercial || "AutoListo";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          if (isSuperAdmin) setOpen(!open);
        }}
        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
          isSuperAdmin
            ? "hover:bg-white/10 cursor-pointer"
            : "cursor-default"
        }`}
        title={isSuperAdmin ? "Conmutador de Talleres (SuperAdmin)" : brandName}
      >
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          {empresa?.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={brandName}
              className="w-7 h-7 rounded-lg object-contain bg-white shrink-0 p-0.5 border border-white/20"
            />
          ) : (
            <div
              style={{ backgroundColor: empresa?.color_primario || "#2563EB" }}
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs"
            >
              {brandName.slice(0, 2).toUpperCase()}
            </div>
          )}

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-white text-xs truncate leading-tight">
                {brandName}
              </span>
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                {empresa?.plan_suscripcion || "STARTER"}
                {isSuperAdmin && (
                  <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 rounded">
                    HQ
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {!collapsed && isSuperAdmin && (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 opacity-70" />
        )}
      </button>

      {/* Dropdown Menu para SuperAdmin */}
      {open && isSuperAdmin && (
        <div className="absolute left-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 text-xs text-slate-100">
          <div className="px-2 py-1.5 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Conmutador Multi-Taller
            </span>
            <Link
              href="/hq"
              onClick={() => setOpen(false)}
              className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>HQ</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>

          {/* Search */}
          <div className="p-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filtrar taller..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Listado de talleres */}
          <div className="max-h-48 overflow-y-auto space-y-1 p-1 custom-scrollbar">
            {filtered.map((e) => {
              const isSelected = e.id === empresa?.id;
              return (
                <button
                  key={e.id}
                  onClick={() => handleSelectEmpresa(e.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-blue-600/20 text-white border border-blue-500/40"
                      : "hover:bg-slate-800/60 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      style={{ backgroundColor: e.color_primario || "#2563EB" }}
                      className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-white text-[9px] shrink-0"
                    >
                      {e.nombre_comercial.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate text-xs font-medium">{e.nombre_comercial}</div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 px-1">
            <button
              onClick={() => {
                setShowManageModal(true);
                setOpen(false);
              }}
              className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gestionar / Nuevo Taller</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Gestión */}
      {showManageModal && (
        <TenantsManagementModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          onTenantSwitched={async (newId) => {
            await switchEmpresa(newId);
            await loadEmpresas();
            setShowManageModal(false);
          }}
        />
      )}
    </div>
  );
}
