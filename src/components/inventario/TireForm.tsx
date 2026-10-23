"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/context/TenantContext";
import { Loader2, Disc, DollarSign, MapPin } from "lucide-react";

export interface TireRecord {
  id: string;
  marca: string;
  modelo_llanta: string;
  ancho: number;
  perfil: number;
  rin: number;
  indice_carga_velocidad: string;
  tipo_terreno: string;
  stock_actual: number;
  stock_minimo: number;
  precio_venta: number;
  costo_adquisicion?: number | null;
  ubicacion_rack?: string | null;
  dot_anio?: string | null;
  sucursal_id?: string | null;
}

interface TireFormProps {
  initialData?: TireRecord | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TireForm({ initialData, onSuccess, onCancel }: TireFormProps) {
  const { sucursalActiva, sucursales } = useTenant();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    marca: initialData?.marca || "",
    modelo_llanta: initialData?.modelo_llanta || "",
    ancho: initialData?.ancho?.toString() || "205",
    perfil: initialData?.perfil?.toString() || "55",
    rin: initialData?.rin?.toString() || "16",
    indice_carga_velocidad: initialData?.indice_carga_velocidad || "91V",
    tipo_terreno: initialData?.tipo_terreno || "HT",
    stock_actual: initialData?.stock_actual?.toString() || "4",
    stock_minimo: initialData?.stock_minimo?.toString() || "4",
    costo_adquisicion: initialData?.costo_adquisicion?.toString() || "1450.00",
    precio_venta: initialData?.precio_venta?.toString() || "2150.00",
    ubicacion_rack: initialData?.ubicacion_rack || "RACK-A1",
    dot_anio: initialData?.dot_anio || "1225",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "ubicacion_rack" || name === "indice_carga_velocidad"
          ? value.toUpperCase()
          : value,
    }));
  };

  const costoNum = parseFloat(formData.costo_adquisicion) || 0;
  const precioNum = parseFloat(formData.precio_venta) || 0;
  const utilidadUnit = precioNum - costoNum;
  const margenPct = precioNum > 0 ? ((utilidadUnit / precioNum) * 100).toFixed(1) : "0.0";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const defaultBranchId =
      initialData?.sucursal_id ||
      sucursalActiva?.id ||
      sucursales.find((s) => s.es_matriz)?.id ||
      sucursales[0]?.id ||
      null;

    const payload: Record<string, any> = {
      marca: formData.marca.trim(),
      modelo_llanta: formData.modelo_llanta.trim(),
      ancho: parseInt(formData.ancho) || 205,
      perfil: parseInt(formData.perfil) || 55,
      rin: parseInt(formData.rin) || 16,
      indice_carga_velocidad: formData.indice_carga_velocidad.trim().toUpperCase(),
      tipo_terreno: formData.tipo_terreno,
      stock_actual: parseInt(formData.stock_actual) || 0,
      stock_minimo: parseInt(formData.stock_minimo) || 2,
      costo_adquisicion: parseFloat(formData.costo_adquisicion) || 0,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      ubicacion_rack: formData.ubicacion_rack.trim().toUpperCase() || null,
      dot_anio: formData.dot_anio.trim() || null,
    };

    if (defaultBranchId) {
      payload.sucursal_id = defaultBranchId;
    }

    let dbError;
    if (initialData?.id) {
      const { error: updErr } = await supabase
        .from("inventario_llantas_base")
        .update(payload)
        .eq("id", initialData.id);
      dbError = updErr;
    } else {
      const { error: insErr } = await supabase
        .from("inventario_llantas_base")
        .insert(payload);
      dbError = insErr;
    }

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      onSuccess();
    }
  };

  const inputClasses =
    "border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-md bg-white text-sm px-3 py-2 w-full transition-all text-slate-800 shadow-xs outline-none";
  const labelClasses = "block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="p-5 space-y-6 flex-1">
        {error && (
          <div className="bg-red-50 text-red-700 text-xs font-medium p-3 rounded-md border border-red-200">
            {error}
          </div>
        )}

        {/* Identificación */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Disc size={14} className="text-blue-600" />
            Marca y Línea del Neumático
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelClasses}>Marca *</label>
              <input
                required
                name="marca"
                value={formData.marca}
                onChange={handleChange}
                placeholder="Ej. Michelin, Bridgestone, Pirelli..."
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Modelo / Diseño de Piso *</label>
              <input
                required
                name="modelo_llanta"
                value={formData.modelo_llanta}
                onChange={handleChange}
                placeholder="Ej. Primacy 4+ / Dueler A/T"
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        {/* Medidas y Especificación */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
            Nomenclatura Técnica ({formData.ancho}/{formData.perfil} R{formData.rin}{" "}
            {formData.indice_carga_velocidad})
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClasses}>Ancho (mm) *</label>
              <input
                required
                type="number"
                name="ancho"
                value={formData.ancho}
                onChange={handleChange}
                placeholder="205"
                className={`${inputClasses} font-mono`}
              />
            </div>
            <div>
              <label className={labelClasses}>Perfil / Serie *</label>
              <input
                required
                type="number"
                name="perfil"
                value={formData.perfil}
                onChange={handleChange}
                placeholder="55"
                className={`${inputClasses} font-mono`}
              />
            </div>
            <div>
              <label className={labelClasses}>Rin (Pulgadas) *</label>
              <input
                required
                type="number"
                name="rin"
                value={formData.rin}
                onChange={handleChange}
                placeholder="16"
                className={`${inputClasses} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelClasses}>Índice de Carga / Velocidad *</label>
              <input
                required
                name="indice_carga_velocidad"
                value={formData.indice_carga_velocidad}
                onChange={handleChange}
                placeholder="Ej. 91V, 94W, 112T"
                className={`${inputClasses} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={labelClasses}>Aplicación / Terreno *</label>
              <select
                required
                name="tipo_terreno"
                value={formData.tipo_terreno}
                onChange={handleChange}
                className={inputClasses}
              >
                <option value="HT">HT (Highway / Carretera)</option>
                <option value="AT">AT (All Terrain / Todo Terreno)</option>
                <option value="MT">MT (Mud Terrain / Lodo)</option>
                <option value="UHP">UHP (Ultra High Performance)</option>
                <option value="All Season">All Season / Turismo</option>
                <option value="Passenger">Passenger / Ciudad</option>
              </select>
            </div>
          </div>
        </div>

        {/* Almacén, Costo y Precio */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <DollarSign size={14} className="text-emerald-600" />
            Costos, Margen Comercial y Ubicación en Rack
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClasses}>Stock Actual *</label>
              <input
                required
                type="number"
                min="0"
                name="stock_actual"
                value={formData.stock_actual}
                onChange={handleChange}
                className={`${inputClasses} font-mono`}
              />
            </div>
            <div>
              <label className={labelClasses}>Stock Mínimo *</label>
              <input
                required
                type="number"
                min="0"
                name="stock_minimo"
                value={formData.stock_minimo}
                onChange={handleChange}
                className={`${inputClasses} font-mono`}
              />
            </div>
            <div>
              <label className={labelClasses}>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={10} /> Rack / Pasillo
                </span>
              </label>
              <input
                name="ubicacion_rack"
                value={formData.ubicacion_rack}
                onChange={handleChange}
                placeholder="RACK-A2"
                className={`${inputClasses} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={labelClasses}>DOT (Sem/Año)</label>
              <input
                name="dot_anio"
                value={formData.dot_anio}
                onChange={handleChange}
                placeholder="Ej. 4224"
                maxLength={6}
                className={`${inputClasses} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
            <div>
              <label className={labelClasses}>Costo Adquisición ($) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                name="costo_adquisicion"
                value={formData.costo_adquisicion}
                onChange={handleChange}
                className={`${inputClasses} font-mono`}
              />
            </div>
            <div>
              <label className={labelClasses}>Precio Público Venta ($) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                name="precio_venta"
                value={formData.precio_venta}
                onChange={handleChange}
                className={`${inputClasses} font-mono font-bold`}
              />
            </div>
            <div className="p-2.5 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                  Margen Bruto
                </span>
                <span className="text-sm font-mono font-black text-emerald-900">
                  {margenPct}%
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                  Utilidad / Pza
                </span>
                <span className="text-xs font-mono font-bold text-emerald-800">
                  +${utilidadUnit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-70 flex items-center gap-1.5 cursor-pointer"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading
            ? "Guardando..."
            : initialData?.id
            ? "Actualizar Neumático"
            : "Registrar Neumático"}
        </button>
      </div>
    </form>
  );
}
