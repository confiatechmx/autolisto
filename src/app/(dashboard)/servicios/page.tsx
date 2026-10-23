"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Wrench, Clock, Edit3, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "../../../components/ui/Modal";
import {
  ServiceForm,
  Service,
  SERVICE_CATEGORIES,
} from "../../../components/servicios/ServiceForm";

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 last:border-0 animate-pulse">
      <td className="px-4 py-3">
        <div className="h-5 bg-slate-200 rounded w-24" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-48 mb-1" />
        <div className="h-3 bg-slate-100 rounded w-64" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 bg-slate-200 rounded w-28" />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="h-4 bg-slate-200 rounded w-16 ml-auto" />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="h-4 bg-slate-200 rounded w-20 ml-auto" />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="h-4 bg-slate-200 rounded w-20 ml-auto" />
      </td>
      <td className="px-4 py-3 text-center">
        <div className="h-5 bg-slate-200 rounded-full w-9 mx-auto" />
      </td>
    </tr>
  );
}

function getCategoryBadgeStyle(cat: string) {
  const c = (cat || "").toLowerCase();
  if (c.includes("freno")) return "bg-red-50 text-red-700 border-red-200";
  if (c.includes("suspensi")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (c.includes("llanta") || c.includes("alineaci"))
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (c.includes("mantenimiento"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (c.includes("diagn"))
    return "bg-purple-50 text-purple-700 border-purple-200";
  if (c.includes("clima")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("servicios_taller")
      .select("*")
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error fetching services:", error);
    } else if (data) {
      setServices(data as Service[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleToggleActive = async (srv: Service) => {
    const nextActive = !srv.activo;
    setServices((prev) =>
      prev.map((s) => (s.id === srv.id ? { ...s, activo: nextActive } : s))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("servicios_taller")
      .update({ activo: nextActive })
      .eq("id", srv.id);

    if (error) {
      setServices((prev) =>
        prev.map((s) => (s.id === srv.id ? { ...s, activo: srv.activo } : s))
      );
      console.error(error);
    }
  };

  const filteredServices = services.filter((srv) => {
    if (selectedCategory !== "Todos") {
      const cat = (srv.categoria || "Mantenimiento").toLowerCase();
      if (!cat.includes(selectedCategory.toLowerCase())) return false;
    }

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      srv.nombre.toLowerCase().includes(query) ||
      (srv.codigo_sku && srv.codigo_sku.toLowerCase().includes(query)) ||
      (srv.categoria && srv.categoria.toLowerCase().includes(query)) ||
      (srv.descripcion && srv.descripcion.toLowerCase().includes(query))
    );
  });

  const activeCount = services.filter((s) => s.activo).length;
  const avgHourlyRate =
    services.length > 0
      ? services.reduce((acc, s) => {
          const hrs = Number(s.horas_estimadas || 1);
          return acc + Number(s.precio || 0) / (hrs > 0 ? hrs : 1);
        }, 0) / services.length
      : 0;

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end mb-4 gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Catálogo de Mano de Obra y Paquetes (Flat-Rate)
            </h1>
            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-xs font-mono font-bold">
              {activeCount} activos de {services.length}
            </span>
            <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-xs font-mono font-bold">
              Tarifa Promedio: $
              {avgHourlyRate.toLocaleString("es-MX", {
                maximumFractionDigits: 0,
              })}
              /hr
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tabulador estandarizado de tiempos de taller, precios base y tarifas por hora.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedService(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-md text-xs font-bold transition-colors shadow-xs cursor-pointer"
        >
          <Plus size={15} strokeWidth={2.5} />
          Nuevo Servicio / Mano de Obra
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="panel-card p-3 mb-3 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 shrink-0">
        {/* Search */}
        <div className="relative w-full xl:w-80 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por código SKU, servicio o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-md bg-slate-50/60 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 text-xs transition-all"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto dense-scrollbar pb-1 xl:pb-0">
          {["Todos", ...SERVICE_CATEGORIES].map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Table */}
      <div className="panel-card overflow-hidden flex-1 flex flex-col bg-white">
        <div className="overflow-x-auto flex-1 dense-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase w-32">
                  Código SKU
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase min-w-[260px]">
                  Servicio y Alcance Técnico
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase">
                  Categoría
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase text-right">
                  Tiempo Est.
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase text-right">
                  Tarifa / Hora
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase text-right">
                  Precio Base
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase text-center w-28">
                  Activo / Editar
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : filteredServices.length > 0 ? (
                filteredServices.map((srv, idx) => {
                  const sku =
                    srv.codigo_sku ||
                    `SRV-${(srv.categoria || "GEN")
                      .slice(0, 3)
                      .toUpperCase()}-${String(idx + 1).padStart(2, "0")}`;
                  const hrs = Number(srv.horas_estimadas || 1.0);
                  const precio = Number(srv.precio || 0);
                  const ratePerHour = hrs > 0 ? precio / hrs : precio;
                  const cat = srv.categoria || "Mantenimiento";

                  return (
                    <tr
                      key={srv.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* SKU */}
                      <td className="px-4 py-3 align-middle">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {sku}
                        </span>
                      </td>

                      {/* Nombre + Descripción */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              onClick={() => {
                                setSelectedService(srv);
                                setIsModalOpen(true);
                              }}
                              className="font-bold text-slate-900 hover:text-blue-600 cursor-pointer text-sm tracking-tight transition-colors"
                            >
                              {srv.nombre}
                            </span>
                            {srv.aplica_promo_llantas && (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                                <Sparkles size={10} /> Promo Llantas
                              </span>
                            )}
                          </div>
                          {srv.descripcion && (
                            <span className="text-xs text-slate-500 mt-0.5 max-w-xl line-clamp-1">
                              {srv.descripcion}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getCategoryBadgeStyle(
                            cat
                          )}`}
                        >
                          {cat}
                        </span>
                      </td>

                      {/* Horas Estimadas */}
                      <td className="px-4 py-3 align-middle text-right">
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-700">
                          <Clock size={11} className="text-slate-400" />
                          {hrs.toFixed(1)} hrs
                        </span>
                      </td>

                      {/* Tarifa / Hora */}
                      <td className="px-4 py-3 align-middle text-right">
                        <span className="font-mono text-xs text-slate-600">
                          $
                          {ratePerHour.toLocaleString("es-MX", {
                            maximumFractionDigits: 0,
                          })}
                          /hr
                        </span>
                      </td>

                      {/* Precio Base */}
                      <td className="px-4 py-3 align-middle text-right">
                        <span className="font-mono text-sm font-black text-slate-900">
                          $
                          {precio.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>

                      {/* Activo + Edit */}
                      <td className="px-4 py-3 align-middle text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <label className="relative inline-flex items-center justify-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={srv.activo}
                              onChange={() => handleToggleActive(srv)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedService(srv);
                              setIsModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Editar servicio"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500 text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <Wrench size={26} className="text-slate-300" />
                      <span>
                        No se encontraron servicios registrados en esta categoría.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for New/Edit Service */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedService ? "Editar Servicio de Taller" : "Registrar Nuevo Servicio"}
        description="Define el código SKU, categoría, horas estándar (Flat-Rate) y precio base."
      >
        <ServiceForm
          initialData={selectedService}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchServices();
          }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
