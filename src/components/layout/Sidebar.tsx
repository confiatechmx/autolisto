"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Kanban,
  Package2,
  Contact,
  Wrench,
  Landmark,
  Settings,
  LayoutDashboard,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Plus,
  Target,
  MessageSquare,
  Receipt,
} from "lucide-react";
import { useTenant } from "@/context/TenantContext";

export function Sidebar() {
  const pathname = usePathname();
  const { empresa } = useTenant();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const iconProps = { strokeWidth: 1.85, size: 18 };

  const operationItems = [
    { href: "/", label: "Resumen Operativo", icon: LayoutDashboard },
    { href: "/tablero", label: "Workflow (Órdenes)", icon: Kanban },
    { href: "/caja", label: "Caja / Punto de Venta (POS)", icon: Receipt },
    { href: "/clientes", label: "Clientes y Vehículos", icon: Contact },
  ];

  const commercialItems = [
    { href: "/ventas", label: "CRM Leads (Pipeline)", icon: Target },
    { href: "/mensajes", label: "Mensajería & WhatsApp", icon: MessageSquare },
  ];

  const catalogAndFinanceItems = [
    { href: "/reportes", label: "Reportes y Analítica (BI)", icon: TrendingUp },
    { href: "/inventario", label: "Inventario y Llantas", icon: Package2 },
    { href: "/servicios", label: "Catálogo Mano de Obra", icon: Wrench },
    { href: "/caja?tab=Comisiones", label: "Nómina de Comisiones", icon: Landmark },
  ];

  const brandName = empresa?.nombre_comercial || "AutoListo";
  const brandInitials = brandName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <aside
        style={{ backgroundColor: empresa?.color_sidebar || "#0F172A" }}
        className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-slate-800/80 transition-all duration-200 relative z-40 select-none ${
          isCollapsed ? "w-[64px]" : "w-[244px]"
        }`}
      >
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
          className="absolute -right-3 top-5 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white rounded-full p-1 z-50 transition-colors shadow-md cursor-pointer"
        >
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        {/* Brand Header */}
        <div className="flex items-center h-14 border-b border-white/10 px-3.5 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 text-white w-full overflow-hidden">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={brandName}
                className="w-8 h-8 rounded-md object-cover shrink-0 border border-white/15 bg-white"
              />
            ) : (
              <div
                style={{ backgroundColor: empresa?.color_primario || "#2563EB" }}
                className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-white text-xs shrink-0 tracking-wider shadow-inner"
              >
                {brandInitials || "AL"}
              </div>
            )}
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm tracking-tight truncate leading-tight">
                  {brandName}
                </span>
                <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">
                  {empresa?.eslogan || "Taller Mecánico"}
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Primary Quick Action (Shopmonkey + Order button) */}
        <div className="px-3 pt-3.5 pb-1 shrink-0">
          <Link
            href="/tablero?nuevaOrden=1"
            style={{ backgroundColor: empresa?.color_primario || "#2563EB" }}
            className={`flex items-center justify-center gap-2 text-white font-medium text-xs rounded-md py-2 px-3 shadow-sm hover:opacity-95 transition-opacity ${
              isCollapsed ? "px-0" : ""
            }`}
            title="Crear Nueva Orden de Servicio"
          >
            <Plus size={15} strokeWidth={2.5} className="shrink-0" />
            {!isCollapsed && <span>Nueva Orden</span>}
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5 no-scrollbar flex flex-col gap-4">
          {/* Grupo 1: Operación */}
          <div className="flex flex-col gap-0.5">
            {!isCollapsed && (
              <p className="px-2.5 text-[10px] font-semibold text-slate-400/70 uppercase tracking-wider mb-1">
                Operación de Piso
              </p>
            )}
            {operationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors relative group ${
                    isActive
                      ? "bg-white/12 text-white font-medium"
                      : "text-slate-300/80 hover:text-white hover:bg-white/6 font-normal"
                  }`}
                >
                  {isActive && (
                    <span
                      style={{ backgroundColor: empresa?.color_primario || "#2563EB" }}
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r"
                    />
                  )}
                  <Icon
                    {...iconProps}
                    className={`shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* Grupo 2: Comercial & CRM */}
          <div className="flex flex-col gap-0.5">
            {!isCollapsed && (
              <p className="px-2.5 text-[10px] font-semibold text-slate-400/70 uppercase tracking-wider mb-1">
                Comercial y Leads
              </p>
            )}
            {commercialItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors relative group ${
                    isActive
                      ? "bg-white/12 text-white font-medium"
                      : "text-slate-300/80 hover:text-white hover:bg-white/6 font-normal"
                  }`}
                >
                  {isActive && (
                    <span
                      style={{ backgroundColor: empresa?.color_primario || "#2563EB" }}
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r"
                    />
                  )}
                  <Icon
                    {...iconProps}
                    className={`shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* Grupo 3: Catálogos & BI */}
          <div className="flex flex-col gap-0.5">
            {!isCollapsed && (
              <p className="px-2.5 text-[10px] font-semibold text-slate-400/70 uppercase tracking-wider mb-1">
                Catálogos y Finanzas
              </p>
            )}
            {catalogAndFinanceItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors relative group ${
                    isActive
                      ? "bg-white/12 text-white font-medium"
                      : "text-slate-300/80 hover:text-white hover:bg-white/6 font-normal"
                  }`}
                >
                  {isActive && (
                    <span
                      style={{ backgroundColor: empresa?.color_primario || "#2563EB" }}
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r"
                    />
                  )}
                  <Icon
                    {...iconProps}
                    className={`shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer: Settings */}
        <div className="p-2.5 border-t border-white/10 shrink-0">
          <Link
            href="/configuracion"
            title={isCollapsed ? "Configuración y Marca" : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors group ${
              pathname.startsWith("/configuracion")
                ? "bg-white/12 text-white font-medium"
                : "text-slate-300/80 hover:text-white hover:bg-white/6 font-normal"
            }`}
          >
            <Settings {...iconProps} className="shrink-0 text-slate-400 group-hover:text-white" />
            {!isCollapsed && <span className="truncate">Configuración y Marca</span>}
          </Link>
        </div>
      </aside>

      {/* Unified Mobile Bottom Navigation Bar (Smartphones only) */}
      <div
        style={{ backgroundColor: empresa?.color_sidebar || "#0F172A" }}
        className="md:hidden fixed bottom-0 left-0 w-full h-15 flex items-center justify-between px-2 z-50 border-t border-white/10 pb-[env(safe-area-inset-bottom)] shadow-xl select-none print:hidden"
      >
        <div className="flex flex-row w-full justify-around items-center">
          {[
            { href: "/tablero", label: "Workflow", icon: Kanban },
            { href: "/", label: "Resumen", icon: LayoutDashboard },
            { href: "/caja", label: "Caja POS", icon: Receipt },
            { href: "/reportes", label: "Reportes", icon: TrendingUp },
          ].map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-md transition-colors ${
                  isActive ? "text-sky-400 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.3 : 1.8} />
                <span className="text-[10px] mt-0.5">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-md text-slate-400 hover:text-white cursor-pointer"
          >
            <Menu size={19} />
            <span className="text-[10px] mt-0.5">Más</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Menu completo con todas las opciones) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="bg-white w-full rounded-t-2xl p-5 relative max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{brandName}</h2>
                <p className="text-xs text-slate-500">Módulos del Taller</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 bg-slate-100 rounded-md text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                ...operationItems,
                ...commercialItems,
                ...catalogAndFinanceItems,
                { href: "/configuracion", label: "Configuración y Marca", icon: Settings },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-800 hover:border-slate-300"
                >
                  <item.icon size={16} className="text-slate-600 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
