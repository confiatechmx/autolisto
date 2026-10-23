"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  Minus,
  MessageCircle,
  Sparkles,
  AlertTriangle,
  Edit3,
  Check,
  MapPin,
  Disc,
  Package,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/context/TenantContext";
import { Modal } from "../../../components/ui/Modal";
import { TireForm, TireRecord } from "../../../components/inventario/TireForm";

interface TireUI extends TireRecord {
  sku: string;
  dimensions: string;
}

const MOUNTING_ALIGNMENT_PACK_PRICE = 1340;

function cleanWhatsAppPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("52") ? digits : `52${digits}`;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 last:border-0 animate-pulse">
      <td className="px-4 py-3">
        <div className="h-5 bg-slate-200 rounded w-28" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-44 mb-1" />
        <div className="h-3 bg-slate-100 rounded w-24" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 bg-slate-200 rounded w-24" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 bg-slate-200 rounded w-16" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 bg-slate-200 rounded w-20 ml-auto" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 bg-slate-200 rounded w-20 ml-auto" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 bg-slate-200 rounded w-24 mx-auto" />
      </td>
    </tr>
  );
}

function InventarioContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const { empresa, sucursalActiva } = useTenant();

  const [inventory, setInventory] = useState<TireUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedRim, setSelectedRim] = useState<number | null>(null);
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Tire Form Modal
  const [isTireModalOpen, setIsTireModalOpen] = useState(false);
  const [editingTire, setEditingTire] = useState<TireUI | null>(null);

  // 3-Tier Quote Generator Modal ("Cotizador Comparativo 3 Opciones")
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteSizeFilter, setQuoteSizeFilter] = useState("");
  const [quoteQuantity, setQuoteQuantity] = useState(4);
  const [includeMountAlign, setIncludeMountAlign] = useState(true);
  const [quoteCustomerName, setQuoteCustomerName] = useState("");
  const [quoteCustomerPhone, setQuoteCustomerPhone] = useState("");
  const [selectedTierIds, setSelectedTierIds] = useState<[string, string, string]>([
    "",
    "",
    "",
  ]);

  useEffect(() => {
    if (initialQ) {
      setSearchQuery(initialQ);
    }
  }, [initialQ]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("inventario_llantas")
      .select("*")
      .order("marca", { ascending: true });

    if (sucursalActiva?.id) {
      query = query.eq("sucursal_id", sucursalActiva.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching inventory:", error);
    } else if (data) {
      const formatted: TireUI[] = data.map((d: any) => ({
        id: d.id,
        sku: `${(d.marca || "LLN").substring(0, 3).toUpperCase()}-${(
          d.modelo_llanta || "MOD"
        )
          .substring(0, 3)
          .toUpperCase()
          .replace(/\s/g, "")}-${d.ancho}${d.perfil}R${d.rin}`,
        marca: d.marca,
        modelo_llanta: d.modelo_llanta,
        ancho: Number(d.ancho),
        perfil: Number(d.perfil),
        rin: Number(d.rin),
        indice_carga_velocidad: d.indice_carga_velocidad || "91V",
        tipo_terreno: d.tipo_terreno || "HT",
        dimensions: `${d.ancho}/${d.perfil} R${d.rin}`,
        stock_actual: Number(d.stock_actual ?? 0),
        stock_minimo: Number(d.stock_minimo ?? 4),
        precio_venta: Number(d.precio_venta ?? 0),
        costo_adquisicion: Number(
          d.costo_adquisicion ?? Number(d.precio_venta ?? 0) * 0.68
        ),
        ubicacion_rack: d.ubicacion_rack || "RACK-A1",
        dot_anio: d.dot_anio || "4024",
        sucursal_id: d.sucursal_id || null,
      }));
      setInventory(formatted);

      // Pre-fill 3 options for quote comparator sorted by price
      if (formatted.length > 0) {
        const sortedByPrice = [...formatted].sort(
          (a, b) => a.precio_venta - b.precio_venta
        );
        const t1 = sortedByPrice[0]?.id || "";
        const t2 =
          sortedByPrice[Math.min(1, sortedByPrice.length - 1)]?.id || "";
        const t3 = sortedByPrice[sortedByPrice.length - 1]?.id || "";
        setSelectedTierIds([t1, t2, t3]);
      }
    }
    setLoading(false);
  }, [sucursalActiva?.id]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleAdjustStock = async (item: TireUI, delta: number) => {
    const nextStock = Math.max(0, item.stock_actual + delta);
    if (nextStock === item.stock_actual) return;

    // Optimistic update
    setInventory((prev) =>
      prev.map((t) => (t.id === item.id ? { ...t, stock_actual: nextStock } : t))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("inventario_llantas_base")
      .update({ stock_actual: nextStock })
      .eq("id", item.id);

    if (error) {
      console.error("Error updating stock:", error);
      setInventory((prev) =>
        prev.map((t) =>
          t.id === item.id ? { ...t, stock_actual: item.stock_actual } : t
        )
      );
    }
  };

  // Auto-pick 3 options (Good / Better / Best) when filtering by size in Quote Modal
  const handleQuoteSizeChange = (sizeVal: string) => {
    setQuoteSizeFilter(sizeVal);
    const matching = inventory
      .filter((t) =>
        sizeVal
          ? t.dimensions.toLowerCase().includes(sizeVal.toLowerCase())
          : true
      )
      .sort((a, b) => a.precio_venta - b.precio_venta);

    if (matching.length > 0) {
      const opt1 = matching[0]?.id || "";
      const opt2 =
        matching[Math.floor(matching.length / 2)]?.id || matching[0]?.id || "";
      const opt3 = matching[matching.length - 1]?.id || "";
      setSelectedTierIds([opt1, opt2, opt3]);
    }
  };

  const uniqueBrands = Array.from(new Set(inventory.map((i) => i.marca))).sort();
  const uniqueRims = Array.from(new Set(inventory.map((i) => i.rin))).sort(
    (a, b) => a - b
  );
  const uniqueDimensions = Array.from(
    new Set(inventory.map((i) => i.dimensions))
  ).sort();

  const filteredInventory = inventory.filter((item) => {
    if (onlyLowStock && item.stock_actual > item.stock_minimo) return false;
    if (selectedBrand && item.marca !== selectedBrand) return false;
    if (selectedRim && item.rin !== selectedRim) return false;

    if (!searchQuery.trim()) return true;
    // Normalize search query so "225/45 R18" or "225/45R18" matches cleanly
    const qNorm = searchQuery.toLowerCase().replace(/\s+/g, "");
    const dimNorm = item.dimensions.toLowerCase().replace(/\s+/g, "");
    const matchSearch =
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.modelo_llanta.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.marca.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dimensions.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dimNorm.includes(qNorm) ||
      (item.ubicacion_rack || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchSearch;
  });

  const totalUnits = inventory.reduce((acc, i) => acc + i.stock_actual, 0);
  const lowStockCount = inventory.filter(
    (i) => i.stock_actual <= i.stock_minimo
  ).length;
  const inventoryCostValue = inventory.reduce(
    (acc, i) => acc + i.stock_actual * Number(i.costo_adquisicion || 0),
    0
  );

  // Build WhatsApp message for 3-Tier Quote
  const buildThreeTierWhatsAppUrl = () => {
    const shopName = empresa?.nombre_comercial || "Torque & Ruta Centro Automotriz";
    const tires = selectedTierIds
      .map((id) => inventory.find((t) => t.id === id))
      .filter(Boolean) as TireUI[];

    const tierLabels = [
      "OPCIÓN 1 · GAMA ECONÓMICA / VALOR",
      "OPCIÓN 2 · GAMA INTERMEDIA (RECOMENDADA ⭐)",
      "OPCIÓN 3 · GAMA PREMIUM OEM",
    ];

    const lines: string[] = [
      `Hola *${quoteCustomerName || "estimado cliente"}*, te compartimos la cotización comparativa de *${quoteQuantity} llantas* en *${shopName}*:`,
      "",
    ];

    tires.forEach((t, idx) => {
      const tiresSub = t.precio_venta * quoteQuantity;
      const pack = includeMountAlign ? MOUNTING_ALIGNMENT_PACK_PRICE : 0;
      const grandTotal = tiresSub + pack;
      lines.push(`*${tierLabels[idx] || `OPCIÓN ${idx + 1}`}*`);
      lines.push(
        `• *${t.marca} ${t.modelo_llanta}* (${t.dimensions} ${t.indice_carga_velocidad})`
      );
      lines.push(
        `• Unitario: $${t.precio_venta.toLocaleString("es-MX", {
          minimumFractionDigits: 2,
        })} x ${quoteQuantity} pzas = $${tiresSub.toLocaleString("es-MX", {
          minimumFractionDigits: 2,
        })}`
      );
      if (includeMountAlign) {
        lines.push(
          `• Incluye Paquete Montaje, Válvulas, Balanceo y Alineación 3D (+$${MOUNTING_ALIGNMENT_PACK_PRICE.toLocaleString(
            "es-MX"
          )})`
        );
      }
      lines.push(
        `👉 *Total llave en mano: $${grandTotal.toLocaleString("es-MX", {
          minimumFractionDigits: 2,
        })} MXN* (Stock disponible: ${t.stock_actual} pzas)`
      );
      lines.push("");
    });

    lines.push("¿Con cuál opción deseas que apartemos tus neumáticos y agendemos tu cita?");

    const phone = cleanWhatsAppPhone(quoteCustomerPhone);
    const base = phone ? `https://wa.me/${phone}` : `https://wa.me/`;
    return `${base}?text=${encodeURIComponent(lines.join("\n"))}`;
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end mb-4 gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Inventario de Llantas y Cotizador 3 Opciones
            </h1>
            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-xs font-mono font-bold">
              {inventory.length} SKUs · {totalUnits} pzas
            </span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-xs font-mono font-bold hidden sm:inline">
              Valor Costo: $
              {inventoryCostValue.toLocaleString("es-MX", {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Control de existencias por rack, DOT, margen bruto y cotizador rápido para WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lowStockCount > 0 && (
            <button
              onClick={() => setOnlyLowStock(!onlyLowStock)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                onlyLowStock
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <AlertTriangle size={14} />
              Stock Bajo ({lowStockCount})
            </button>
          )}

          <button
            onClick={() => {
              if (searchQuery && uniqueDimensions.some((d) => d.includes(searchQuery))) {
                handleQuoteSizeChange(searchQuery);
              }
              setIsQuoteModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-md text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Sparkles size={14} />
            Cotizador Rápido WhatsApp (3 Opciones)
          </button>

          <button
            onClick={() => {
              setEditingTire(null);
              setIsTireModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-md text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            Agregar Llanta
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="panel-card p-3 mb-3 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar medida (ej. 205/55 R16), marca, modelo, SKU o rack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-7 py-1.5 border border-slate-200 rounded-md bg-slate-50/60 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 text-xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Rim Pills */}
          <div className="flex items-center gap-1 overflow-x-auto dense-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">
              Rin:
            </span>
            <button
              onClick={() => setSelectedRim(null)}
              className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                selectedRim === null
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos
            </button>
            {uniqueRims.map((rin) => (
              <button
                key={rin}
                onClick={() => setSelectedRim(selectedRim === rin ? null : rin)}
                className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  selectedRim === rin
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                R{rin}
              </button>
            ))}
          </div>
        </div>

        {/* Brand Quick Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto dense-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">
            Marca:
          </span>
          {uniqueBrands.map((brand) => (
            <button
              key={brand}
              onClick={() =>
                setSelectedBrand(selectedBrand === brand ? null : brand)
              }
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedBrand === brand
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table Container */}
      <div className="panel-card overflow-hidden flex-1 flex flex-col bg-white">
        <div className="overflow-x-auto flex-1 dense-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase">
                  SKU / Ubicación
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase">
                  Marca y Modelo
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase">
                  Medida / Índice
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase">
                  Terreno / DOT
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase text-right">
                  Costo / Margen
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase text-right">
                  Precio Público
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase text-center">
                  Stock Actual
                </th>
                <th className="px-4 py-2.5 text-[11px] tracking-wider text-slate-500 font-bold uppercase text-right">
                  Acciones
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
                  <SkeletonRow />
                </>
              ) : filteredInventory.length > 0 ? (
                filteredInventory.map((item) => {
                  const costo = Number(item.costo_adquisicion || 0);
                  const precio = Number(item.precio_venta || 0);
                  const margen =
                    precio > 0 ? (((precio - costo) / precio) * 100).toFixed(0) : "0";
                  const isLow = item.stock_actual <= item.stock_minimo;
                  const isZero = item.stock_actual === 0;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* SKU + Rack */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 w-fit">
                            {item.sku}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 inline-flex items-center gap-1">
                            <MapPin size={10} className="text-slate-400" />
                            {item.ubicacion_rack || "RACK-A1"}
                          </span>
                        </div>
                      </td>

                      {/* Marca y Modelo */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm tracking-tight">
                            {item.marca} {item.modelo_llanta}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Juego de 4: $
                            {(precio * 4).toLocaleString("es-MX", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Medida */}
                      <td className="px-4 py-3 align-middle">
                        <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                          {item.dimensions} {item.indice_carga_velocidad}
                        </span>
                      </td>

                      {/* Terreno / DOT */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded w-fit">
                            {item.tipo_terreno}
                          </span>
                          {item.dot_anio && (
                            <span className="text-[10px] font-mono text-slate-500">
                              DOT: {item.dot_anio}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Costo / Margen */}
                      <td className="px-4 py-3 align-middle text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-xs text-slate-600">
                            ${costo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            Margen {margen}%
                          </span>
                        </div>
                      </td>

                      {/* Precio Público */}
                      <td className="px-4 py-3 align-middle text-right">
                        <span className="font-mono text-sm font-black text-slate-900">
                          ${precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Stock con ajuste rápido + / - */}
                      <td className="px-4 py-3 align-middle text-center">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md p-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(item, -1)}
                            disabled={item.stock_actual <= 0}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                            title="Descontar 1 unidad"
                          >
                            <Minus size={11} />
                          </button>
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded min-w-[32px] ${
                              isZero
                                ? "bg-red-100 text-red-700"
                                : isLow
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {item.stock_actual}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(item, 1)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                            title="Sumar 1 unidad"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 align-middle text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              handleQuoteSizeChange(item.dimensions);
                              setIsQuoteModalOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-colors cursor-pointer"
                            title="Cotizar esta medida en 3 opciones"
                          >
                            Cotizar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTire(item);
                              setIsTireModalOpen(true);
                            }}
                            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Editar neumático"
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
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500 text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={28} className="text-slate-300" />
                      <span>
                        No se encontraron neumáticos con la medida o filtro{" "}
                        {searchQuery ? `"${searchQuery}"` : "seleccionado"}.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Agregar / Editar Llanta */}
      <Modal
        isOpen={isTireModalOpen}
        onClose={() => {
          setIsTireModalOpen(false);
          setEditingTire(null);
        }}
        title={editingTire ? "Editar Neumático en Catálogo" : "Registrar Nueva Llanta"}
        description="Especificaciones técnicas, ubicación en rack, DOT, costo y precio público."
      >
        <TireForm
          initialData={editingTire}
          onSuccess={() => {
            setIsTireModalOpen(false);
            setEditingTire(null);
            fetchInventory();
          }}
          onCancel={() => {
            setIsTireModalOpen(false);
            setEditingTire(null);
          }}
        />
      </Modal>

      {/* Modal: Cotizador Comparativo 3 Opciones (Bueno / Mejor / Excelente) */}
      <Modal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        title="Cotizador Comparativo 3 Opciones (Bueno / Mejor / Excelente)"
        description="Genera en segundos una propuesta comercial de 3 gamas lista para enviar por WhatsApp al cliente."
        size="xl"
      >
        <div className="p-5 space-y-5">
          {/* Top Config Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Filtrar Medida
              </label>
              <select
                value={quoteSizeFilter}
                onChange={(e) => handleQuoteSizeChange(e.target.value)}
                className="border border-slate-200 rounded bg-white text-xs font-mono font-bold px-2.5 py-2 w-full"
              >
                <option value="">Todas las medidas</option>
                {uniqueDimensions.map((dim) => (
                  <option key={dim} value={dim}>
                    {dim}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Cantidad de Llantas
              </label>
              <select
                value={quoteQuantity}
                onChange={(e) => setQuoteQuantity(Number(e.target.value))}
                className="border border-slate-200 rounded bg-white text-xs font-bold px-2.5 py-2 w-full"
              >
                <option value={1}>1 Llanta</option>
                <option value={2}>2 Llantas (Par)</option>
                <option value={4}>4 Llantas (Juego Completo)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Nombre del Cliente
              </label>
              <input
                type="text"
                value={quoteCustomerName}
                onChange={(e) => setQuoteCustomerName(e.target.value)}
                placeholder="Ej. Carlos Salinas"
                className="border border-slate-200 rounded bg-white text-xs px-2.5 py-2 w-full"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                WhatsApp Cliente
              </label>
              <input
                type="text"
                value={quoteCustomerPhone}
                onChange={(e) => setQuoteCustomerPhone(e.target.value)}
                placeholder="Ej. 81 1234 5678"
                className="border border-slate-200 rounded bg-white text-xs font-mono px-2.5 py-2 w-full"
              />
            </div>
          </div>

          {/* Toggle Mounting + Alignment */}
          <label className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50/50 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={includeMountAlign}
                onChange={(e) => setIncludeMountAlign(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Incluir Paquete de Instalación + Válvulas Nuevas + Balanceo + Alineación 3D
                </span>
                <span className="text-[11px] text-slate-600">
                  Incrementa el ticket promedio agregando el servicio completo llave en mano.
                </span>
              </div>
            </div>
            <span className="font-mono text-xs font-black text-blue-700 bg-white px-2.5 py-1 rounded border border-blue-200">
              +${MOUNTING_ALIGNMENT_PACK_PRICE.toLocaleString("es-MX")} MXN
            </span>
          </label>

          {/* 3-Column Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                idx: 0,
                title: "Opción 1 · Económica / Valor",
                badge: "Ajustada a Presupuesto",
                border: "border-slate-200 bg-white",
                headerBg: "bg-slate-100 text-slate-800",
              },
              {
                idx: 1,
                title: "Opción 2 · Equilibrio / Mejor",
                badge: "Más Vendida ⭐",
                border: "border-blue-500 ring-1 ring-blue-500 bg-blue-50/20",
                headerBg: "bg-blue-600 text-white",
              },
              {
                idx: 2,
                title: "Opción 3 · Gama Premium OEM",
                badge: "Máximo Desempeño",
                border: "border-slate-800 bg-white",
                headerBg: "bg-slate-900 text-white",
              },
            ].map((tier) => {
              const selectedId = selectedTierIds[tier.idx];
              const tire = inventory.find((t) => t.id === selectedId);
              const candidateTires = inventory.filter((t) =>
                quoteSizeFilter
                  ? t.dimensions
                      .toLowerCase()
                      .includes(quoteSizeFilter.toLowerCase())
                  : true
              );

              const subLlantas = (tire?.precio_venta || 0) * quoteQuantity;
              const pack = includeMountAlign ? MOUNTING_ALIGNMENT_PACK_PRICE : 0;
              const totalTier = subLlantas + pack;

              return (
                <div
                  key={tier.idx}
                  className={`rounded-lg border overflow-hidden flex flex-col justify-between ${tier.border}`}
                >
                  <div>
                    <div
                      className={`px-3.5 py-2 flex items-center justify-between text-xs font-bold ${tier.headerBg}`}
                    >
                      <span>{tier.title}</span>
                      <span className="text-[10px] uppercase opacity-90">
                        {tier.badge}
                      </span>
                    </div>

                    <div className="p-3.5 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Seleccionar Neumático
                        </label>
                        <select
                          value={selectedId}
                          onChange={(e) => {
                            const next: [string, string, string] = [
                              ...selectedTierIds,
                            ] as [string, string, string];
                            next[tier.idx] = e.target.value;
                            setSelectedTierIds(next);
                          }}
                          className="border border-slate-200 rounded bg-white text-xs font-semibold px-2.5 py-2 w-full"
                        >
                          {candidateTires.map((ct) => (
                            <option key={ct.id} value={ct.id}>
                              {ct.marca} {ct.modelo_llanta} ({ct.dimensions}) - $
                              {ct.precio_venta.toLocaleString("es-MX")}
                            </option>
                          ))}
                        </select>
                      </div>

                      {tire && (
                        <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Medida / Índice:</span>
                            <span className="font-mono font-bold text-slate-800">
                              {tire.dimensions} {tire.indice_carga_velocidad}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Precio Unitario:</span>
                            <span className="font-mono font-semibold text-slate-800">
                              $
                              {tire.precio_venta.toLocaleString("es-MX", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">
                              Subtotal ({quoteQuantity} llantas):
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              $
                              {subLlantas.toLocaleString("es-MX", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          {includeMountAlign && (
                            <div className="flex items-center justify-between text-emerald-700 font-medium">
                              <span className="inline-flex items-center gap-1">
                                <Check size={12} /> Montaje + Alineación:
                              </span>
                              <span className="font-mono font-bold">
                                +${MOUNTING_ALIGNMENT_PACK_PRICE.toLocaleString("es-MX")}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-500">
                      Total Llave en Mano
                    </span>
                    <span className="text-base font-mono font-black text-slate-900">
                      $
                      {totalTier.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Disc size={14} className="text-blue-600" />
              Se enviará un desglose comparativo claro de las 3 opciones por WhatsApp.
            </span>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsQuoteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Cerrar
              </button>
              <a
                href={buildThreeTierWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <MessageCircle size={14} />
                Enviar Comparativa por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function InventarioPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      }
    >
      <InventarioContent />
    </Suspense>
  );
}
