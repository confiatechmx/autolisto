"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Wrench, Clock, DollarSign } from "lucide-react";

export interface Service {
  id: string;
  codigo_sku?: string | null;
  nombre: string;
  categoria?: string | null;
  descripcion: string;
  precio: number;
  horas_estimadas?: number | null;
  aplica_promo_llantas?: boolean | null;
  activo: boolean;
}

interface ServiceFormProps {
  initialData?: Service | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const SERVICE_CATEGORIES = [
  "Mantenimiento",
  "Frenos",
  "Suspensión",
  "Llantas y Alineación",
  "Diagnóstico",
  "Climatización",
  "Transmisión",
];

export function ServiceForm({ initialData, onSuccess, onCancel }: ServiceFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    codigo_sku: initialData?.codigo_sku || "",
    nombre: initialData?.nombre || "",
    categoria: initialData?.categoria || "Mantenimiento",
    descripcion: initialData?.descripcion || "",
    precio: initialData?.precio?.toString() || "850.00",
    horas_estimadas: (initialData?.horas_estimadas ?? 1.0).toString(),
    aplica_promo_llantas: Boolean(initialData?.aplica_promo_llantas),
    activo: initialData ? initialData.activo : true,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target;
    const value =
      target.type === "checkbox"
        ? (target as HTMLInputElement).checked
        : target.name === "codigo_sku"
        ? target.value.toUpperCase()
        : target.value;
    setFormData((prev) => ({ ...prev, [target.name]: value }));
  };

  const precioNum = parseFloat(formData.precio) || 0;
  const horasNum = parseFloat(formData.horas_estimadas) || 1;
  const tarifaHora = horasNum > 0 ? precioNum / horasNum : precioNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const autoSku =
      formData.codigo_sku.trim().toUpperCase() ||
      `SRV-${formData.categoria.slice(0, 3).toUpperCase()}-${Math.floor(
        100 + Math.random() * 900
      )}`;

    const payload = {
      codigo_sku: autoSku,
      nombre: formData.nombre.trim(),
      categoria: formData.categoria,
      descripcion: formData.descripcion.trim(),
      precio: parseFloat(formData.precio) || 0,
      horas_estimadas: parseFloat(formData.horas_estimadas) || 1.0,
      aplica_promo_llantas: formData.aplica_promo_llantas,
      activo: formData.activo,
    };

    const supabase = createClient();
    let dbError;
    if (initialData?.id) {
      const { error: updErr } = await supabase
        .from("servicios_taller")
        .update(payload)
        .eq("id", initialData.id);
      dbError = updErr;
    } else {
      const { error: insErr } = await supabase
        .from("servicios_taller")
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
      <div className="p-5 space-y-5 flex-1">
        {error && (
          <div className="bg-red-50 text-red-700 text-xs font-medium p-3 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <div className="space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Wrench size={14} className="text-blue-600" />
            Identificación de Mano de Obra / Paquete
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className={labelClasses}>Código SKU</label>
              <input
                name="codigo_sku"
                value={formData.codigo_sku}
                onChange={handleChange}
                placeholder="Ej. SRV-ALI-01"
                className={`${inputClasses} font-mono uppercase`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClasses}>Categoría Operativa *</label>
              <select
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                className={inputClasses}
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClasses}>Nombre del Servicio *</label>
            <input
              required
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej. Alineación 3D y Balanceo por Computadora (4 Ruedas)"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>
              Descripción Técnica / Alcance del Servicio
            </label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={2}
              placeholder="Ej. Incluye ajuste de convergencia, camber, plomos adhesivos y calibración N2..."
              className={`${inputClasses} resize-y`}
            />
          </div>
        </div>

        {/* Tiempos Estándar y Tarifa */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Clock size={14} className="text-emerald-600" />
            Tiempos Estándar (Flat-Rate) y Precio Base
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
            <div>
              <label className={labelClasses}>Horas Estimadas (Hrs) *</label>
              <input
                required
                type="number"
                min="0.1"
                step="0.1"
                name="horas_estimadas"
                value={formData.horas_estimadas}
                onChange={handleChange}
                className={`${inputClasses} font-mono`}
              />
            </div>

            <div>
              <label className={labelClasses}>Precio Mano de Obra ($) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 text-sm font-mono">
                  $
                </span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  name="precio"
                  value={formData.precio}
                  onChange={handleChange}
                  placeholder="0.00"
                  className={`${inputClasses} pl-7 font-mono font-bold`}
                />
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Tarifa Efectiva / Hr
                </span>
                <span className="text-sm font-mono font-black text-slate-900">
                  ${tarifaHora.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                  /hr
                </span>
              </div>
              <DollarSign size={16} className="text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Switches */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <label className="flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100/60 transition-colors">
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Aplica en Promoción de Compra de 4 Llantas
              </span>
              <span className="text-[11px] text-slate-500">
                Permite bonificar o descontar este servicio en paquetes de neumáticos.
              </span>
            </div>
            <input
              type="checkbox"
              name="aplica_promo_llantas"
              checked={formData.aplica_promo_llantas}
              onChange={handleChange}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100/60 transition-colors">
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Servicio Activo en Estimador y POS
              </span>
              <span className="text-[11px] text-slate-500">
                Visible para agregar en nuevas órdenes de servicio.
              </span>
            </div>
            <input
              type="checkbox"
              name="activo"
              checked={formData.activo}
              onChange={handleChange}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
          </label>
        </div>
      </div>

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
            : initialData
            ? "Actualizar Servicio"
            : "Guardar Servicio"}
        </button>
      </div>
    </form>
  );
}
