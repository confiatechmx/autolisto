"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Bell,
  ChevronDown,
  Building2,
  Palette,
  Car,
  User,
  Wrench,
  AlertTriangle,
  Check,
  LogOut,
  ExternalLink,
  Plus,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { useTenant, WHITE_LABEL_PRESETS } from "@/context/TenantContext";
import { createClient } from "@/lib/supabase/client";

export function Topbar() {
  const router = useRouter();
  const { empresa, sucursales, sucursalActiva, setSucursalActivaId, perfil, updateBrandTheme } = useTenant();

  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  // Global search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    orders: any[];
    vehicles: any[];
    clients: any[];
  }>({ orders: [], vehicles: [], clients: [] });

  // Operational alerts (Deferred work + low stock)
  const [deferredAlerts, setDeferredAlerts] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);

  const searchRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false);
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) setBranchMenuOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeMenuOpen(false);
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setAlertsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = searchRef.current?.querySelector("input");
        input?.focus();
        setSearchFocused(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load alerts count
  useEffect(() => {
    async function loadAlerts() {
      const supabase = createClient();
      const [{ data: defData }, { data: stockData }] = await Promise.all([
        supabase
          .from("trabajos_diferidos")
          .select("id, concepto, costo_estimado, severidad, vehiculo_id, cliente_id, vehiculos(marca, modelo, placas), clientes(nombre)")
          .eq("resuelto", false)
          .limit(6),
        supabase
          .from("inventario_llantas")
          .select("id, marca, modelo_llanta, ancho, perfil, rin, stock_actual, stock_minimo")
          .lte("stock_actual", 4)
          .limit(5),
      ]);
      if (defData) setDeferredAlerts(defData);
      if (stockData) setLowStockAlerts(stockData);
    }
    loadAlerts();
  }, []);

  // Global search live query
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults({ orders: [], vehicles: [], clients: [] });
      return;
    }

    const timer = setTimeout(async () => {
      const supabase = createClient();
      const [{ data: ordData }, { data: vehData }, { data: cliData }] = await Promise.all([
        supabase
          .from("ordenes_servicio")
          .select("id, folio, estado, problema_reportado, vehiculos(marca, modelo, placas, clientes(nombre))")
          .limit(15),
        supabase
          .from("vehiculos")
          .select("id, marca, modelo, anio, placas, vin, cliente_id, clientes(nombre)")
          .or(`placas.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%,vin.ilike.%${q}%`)
          .limit(5),
        supabase
          .from("clientes")
          .select("id, nombre, telefono, empresa")
          .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,empresa.ilike.%${q}%`)
          .limit(5),
      ]);

      const lower = q.toLowerCase();
      const matchedOrders = (ordData || []).filter((o: any) => {
        const folioStr = `#${o.folio || ""}`;
        const carStr = `${o.vehiculos?.marca || ""} ${o.vehiculos?.modelo || ""} ${o.vehiculos?.placas || ""}`.toLowerCase();
        const clientStr = (o.vehiculos?.clientes?.nombre || "").toLowerCase();
        return (
          folioStr.includes(lower) ||
          carStr.includes(lower) ||
          clientStr.includes(lower) ||
          (o.problema_reportado || "").toLowerCase().includes(lower)
        );
      });

      setSearchResults({
        orders: matchedOrders.slice(0, 5),
        vehicles: vehData || [],
        clients: cliData || [],
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const totalAlerts = deferredAlerts.length + lowStockAlerts.length;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const userInitials = (perfil?.nombre || "Eduardo Cova")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between px-4 md:px-6 bg-white border-b border-slate-200 w-full">
      <div className="flex items-center gap-3 md:gap-5 flex-1">
        {/* Branch / Tenant Selector */}
        <div ref={branchRef} className="relative">
          <button
            onClick={() => setBranchMenuOpen(!branchMenuOpen)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition-colors border border-slate-200/80 cursor-pointer"
          >
            <div
              style={{ backgroundColor: empresa?.color_primario || "#2563EB" }}
              className="p-1.5 rounded text-white shadow-2xs"
            >
              <Building2 size={14} strokeWidth={2} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-900 leading-none">
                {sucursalActiva ? sucursalActiva.nombre : "Todas las Sucursales"}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-none">
                {empresa?.nombre_comercial || "Torque & Ruta"}
              </span>
            </div>
            <ChevronDown size={13} className="text-slate-400 ml-1" />
          </button>

          {branchMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50">
              <div className="px-3 py-1.5 border-b border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Filtrar Operación por Sucursal
                </p>
              </div>
              <button
                onClick={() => {
                  setSucursalActivaId(null);
                  setBranchMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="font-semibold text-slate-900">Todas las Sucursales (Global)</p>
                  <p className="text-[11px] text-slate-500">Vista consolidada de todas las bahías</p>
                </div>
                {!sucursalActiva && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>
              {sucursales.map((suc) => (
                <button
                  key={suc.id}
                  onClick={() => {
                    setSucursalActivaId(suc.id);
                    setBranchMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition-colors border-t border-slate-50"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 truncate">{suc.nombre}</span>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                        {suc.codigo}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{suc.direccion}</p>
                  </div>
                  {sucursalActiva?.id === suc.id && <Check size={14} className="text-blue-600 shrink-0" />}
                </button>
              ))}
              <div className="border-t border-slate-100 mt-1 pt-1 px-2">
                <button
                  onClick={() => {
                    setBranchMenuOpen(false);
                    router.push("/configuracion?tab=Sucursales");
                  }}
                  className="w-full text-left px-2 py-1.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  + Administrar Sucursales...
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Deep-Link Search Bar */}
        <div ref={searchRef} className="relative max-w-md w-full hidden sm:block">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchFocused(true);
              }}
              placeholder="Buscar orden (#folio), placa, vehículo o cliente..."
              className="block w-full pl-8 pr-12 py-1.5 border border-slate-200 rounded-md bg-slate-50/70 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary text-xs transition-all"
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
              <kbd className="inline-flex items-center text-[10px] font-mono font-medium text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Live Deep-Link Search Dropdown */}
          {searchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50 max-h-[420px] overflow-y-auto dense-scrollbar">
              {searchResults.orders.length === 0 &&
              searchResults.vehicles.length === 0 &&
              searchResults.clients.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-500">
                  No se encontraron órdenes, vehículos ni clientes para &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {searchResults.orders.length > 0 && (
                    <div>
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Órdenes de Servicio (Abrir Expediente)
                      </p>
                      {searchResults.orders.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => {
                            setSearchFocused(false);
                            setSearchQuery("");
                            router.push(`/tablero?ordenId=${o.id}`);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Wrench size={13} className="text-blue-600 shrink-0" />
                            <div className="truncate">
                              <span className="text-xs font-semibold text-slate-900">
                                Orden #{o.folio || o.id.slice(0, 4)} • {o.vehiculos?.marca} {o.vehiculos?.modelo}
                              </span>
                              <span className="ml-1.5 text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {o.vehiculos?.placas}
                              </span>
                              <p className="text-[11px] text-slate-500 truncate">
                                {o.vehiculos?.clientes?.nombre} — {o.estado}
                              </p>
                            </div>
                          </div>
                          <ExternalLink size={12} className="text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.vehicles.length > 0 && (
                    <div className="border-t border-slate-100 pt-1">
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Vehículos Registrados
                      </p>
                      {searchResults.vehicles.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setSearchFocused(false);
                            setSearchQuery("");
                            router.push(`/clientes/${v.cliente_id}?vehiculoId=${v.id}`);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Car size={13} className="text-emerald-600 shrink-0" />
                            <div className="truncate">
                              <span className="text-xs font-semibold text-slate-900">
                                {v.marca} {v.modelo} ({v.anio})
                              </span>
                              <span className="ml-1.5 text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                {v.placas || "S/P"}
                              </span>
                              <p className="text-[11px] text-slate-500 truncate">
                                Propietario: {v.clientes?.nombre}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] text-blue-600 font-medium shrink-0">Ver Historial →</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.clients.length > 0 && (
                    <div className="border-t border-slate-100 pt-1">
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Clientes / Flotillas
                      </p>
                      {searchResults.clients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSearchFocused(false);
                            setSearchQuery("");
                            router.push(`/clientes/${c.id}`);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <User size={13} className="text-slate-500 shrink-0" />
                            <div className="truncate">
                              <span className="text-xs font-semibold text-slate-900">{c.nombre}</span>
                              {c.empresa && (
                                <span className="ml-1.5 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                  {c.empresa}
                                </span>
                              )}
                              <p className="text-[11px] text-slate-500">{c.telefono}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-blue-600 font-medium shrink-0">Expediente →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Tools: White-Label Live Switcher, Alerts, Profile */}
      <div className="flex items-center gap-2.5">
        {/* Caja / POS Direct Shortcut */}
        <Link
          href="/caja"
          title="Terminal de Cobro Rápido (POS)"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer"
        >
          <Receipt size={14} className="text-emerald-700" />
          <span>Caja POS</span>
        </Link>
        <Link
          href="/reportes"
          title="Reportes y Analítica (BI)"
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition-colors cursor-pointer"
        >
          <TrendingUp size={14} className="text-sky-700" />
          <span>Reportes</span>
        </Link>

        {/* White-Label Live Customizer Pill */}
        <div ref={themeRef} className="relative">
          <button
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            title="Personalización White-Label del Tenant en vivo"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <Palette size={14} style={{ color: empresa?.color_primario || "#2563EB" }} />
            <span>White-Label</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {themeMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50">
              <div className="mb-2 pb-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">Identidad Visual del Taller (Tenant)</p>
                <p className="text-[11px] text-slate-500">
                  Cambia en tiempo real los colores e identidad de marca del taller.
                </p>
              </div>
              <div className="space-y-1.5">
                {WHITE_LABEL_PRESETS.map((preset) => {
                  const isSelected =
                    empresa?.color_primario?.toLowerCase() === preset.primary.toLowerCase();
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        updateBrandTheme({
                          color_primario: preset.primary,
                          color_sidebar: preset.sidebar,
                        });
                        setThemeMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-md border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200/70 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center -space-x-1">
                          <span
                            style={{ backgroundColor: preset.sidebar }}
                            className="w-4 h-4 rounded-full border border-white shadow-2xs"
                          />
                          <span
                            style={{ backgroundColor: preset.primary }}
                            className="w-4 h-4 rounded-full border border-white shadow-2xs"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 leading-none">{preset.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{preset.badge}</p>
                        </div>
                      </div>
                      {isSelected && <Check size={14} className="text-slate-900" />}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  setThemeMenuOpen(false);
                  router.push("/configuracion");
                }}
                className="mt-2.5 w-full py-1.5 text-center text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                Configurar Logo, Nombre y Términos →
              </button>
            </div>
          )}
        </div>

        {/* Deferred Work & Low Stock Notifications */}
        <div ref={alertsRef} className="relative">
          <button
            onClick={() => setAlertsOpen(!alertsOpen)}
            className="relative p-2 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
            title="Alertas de Trabajos Diferidos y Stock"
          >
            <Bell size={18} strokeWidth={1.85} />
            {totalAlerts > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {totalAlerts}
              </span>
            )}
          </button>

          {alertsOpen && (
            <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50 max-h-[420px] overflow-y-auto dense-scrollbar">
              <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Centro de Alertas Operativas</span>
                <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  {totalAlerts} activas
                </span>
              </div>

              {deferredAlerts.length > 0 && (
                <div className="py-1">
                  <p className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Trabajos Diferidos (Oportunidades de Retorno)
                  </p>
                  {deferredAlerts.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setAlertsOpen(false);
                        router.push(`/clientes/${d.cliente_id}?vehiculoId=${d.vehiculo_id}`);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-start gap-2.5 border-b border-slate-50 last:border-0"
                    >
                      <AlertTriangle
                        size={14}
                        className={`mt-0.5 shrink-0 ${
                          d.severidad === "rojo" ? "text-red-600" : "text-amber-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">{d.concepto}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {d.vehiculos?.marca} {d.vehiculos?.modelo} ({d.vehiculos?.placas}) • {d.clientes?.nombre}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-800 shrink-0">
                        ${Number(d.costo_estimado || 0).toLocaleString("es-MX")}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {lowStockAlerts.length > 0 && (
                <div className="py-1 border-t border-slate-100">
                  <p className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Stock Bajo de Neumáticos
                  </p>
                  {lowStockAlerts.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setAlertsOpen(false);
                        router.push(`/inventario?q=${encodeURIComponent(t.modelo_llanta)}`);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {t.marca} {t.modelo_llanta}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Medida {t.ancho}/{t.perfil} R{t.rin}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">
                        {t.stock_actual} disp.
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-900 leading-none">
              {perfil?.nombre || "Eduardo Cova"}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">{perfil?.rol || "Administrador"}</span>
          </div>
          <div
            style={{ backgroundColor: empresa?.color_primario || "#2563EB" }}
            className="h-8 w-8 rounded-md flex items-center justify-center text-white text-xs font-bold shadow-2xs"
          >
            {userInitials}
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
