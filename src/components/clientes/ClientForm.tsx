"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Building2, UserCheck, Tag } from "lucide-react";

export interface ClientFormData {
  id?: string;
  nombre: string;
  telefono: string;
  correo?: string | null;
  empresa?: string | null;
  rfc?: string | null;
  fuente_adquisicion?: string | null;
  notas_internas?: string | null;
  tags?: string[];
}

interface ClientFormProps {
  initialData?: ClientFormData | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const PRESET_TAGS = ["vip", "flotilla", "frecuente", "credito", "corporativo"];

export function ClientForm({ initialData, onSuccess, onCancel }: ClientFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    nombre: initialData?.nombre || "",
    telefono: initialData?.telefono || "",
    correo: initialData?.correo || "",
    empresa: initialData?.empresa || "",
    rfc: initialData?.rfc || "",
    fuente_adquisicion: initialData?.fuente_adquisicion || "Local",
    notas_internas: initialData?.notas_internas || "",
    tags: initialData?.tags || ([] as string[]),
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "rfc" ? value.toUpperCase() : value,
    }));
  };

  const toggleTag = (tag: string) => {
    setFormData((prev) => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      nombre: formData.nombre.trim(),
      telefono: formData.telefono.trim(),
      correo: formData.correo.trim() || null,
      empresa: formData.empresa.trim() || null,
      rfc: formData.rfc.trim().toUpperCase() || null,
      fuente_adquisicion: formData.fuente_adquisicion || "Local",
      notas_internas: formData.notas_internas.trim() || null,
      tags: formData.tags,
    };

    const supabase = createClient();
    let dbError;

    if (initialData?.id) {
      const { error: updErr } = await supabase
        .from("clientes")
        .update(payload)
        .eq("id", initialData.id);
      dbError = updErr;
    } else {
      const { error: insErr } = await supabase.from("clientes").insert(payload);
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

        {/* Datos de Contacto */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <UserCheck size={14} className="text-blue-600" />
            Datos del Cliente / Contacto Principal
          </h3>
          <div className="grid grid-cols-1 gap-3.5">
            <div>
              <label className={labelClasses}>Nombre Completo o Responsable *</label>
              <input
                required
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Ej. Roberto Garza Sada"
                className={inputClasses}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClasses}>Teléfono (WhatsApp) *</label>
                <input
                  required
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="Ej. 81 1234 5678"
                  className={`${inputClasses} font-mono`}
                />
              </div>
              <div>
                <label className={labelClasses}>Correo Electrónico</label>
                <input
                  type="email"
                  name="correo"
                  value={formData.correo}
                  onChange={handleChange}
                  placeholder="cliente@empresa.com"
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Datos Fiscales y Flotilla */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Building2 size={14} className="text-slate-500" />
            Flotilla, Facturación y Origen
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className={labelClasses}>Empresa / Flotilla</label>
              <input
                name="empresa"
                value={formData.empresa}
                onChange={handleChange}
                placeholder="Ej. Logística del Norte S.A."
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>RFC Fiscal</label>
              <input
                name="rfc"
                value={formData.rfc}
                onChange={handleChange}
                placeholder="Ej. LNO1904128A1"
                className={`${inputClasses} uppercase font-mono`}
              />
            </div>
            <div>
              <label className={labelClasses}>Fuente de Adquisición</label>
              <select
                name="fuente_adquisicion"
                value={formData.fuente_adquisicion}
                onChange={handleChange}
                className={inputClasses}
              >
                <option value="Local">Local / Tráfico de Calle</option>
                <option value="WhatsApp">WhatsApp Directo</option>
                <option value="Referido">Recomendación / Referido</option>
                <option value="Convenio Flotilla">Convenio Flotilla</option>
                <option value="Google">Google Maps / Búsqueda</option>
                <option value="Facebook">Facebook / Instagram</option>
                <option value="Telefono">Llamada Telefónica</option>
              </select>
            </div>
          </div>

          {/* Etiquetas */}
          <div>
            <label className={labelClasses}>
              <span className="inline-flex items-center gap-1">
                <Tag size={11} /> Etiquetas de Clasificación CRM
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PRESET_TAGS.map((tag) => {
                const active = formData.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {active ? `✓ ${tag}` : `+ ${tag}`}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelClasses}>Notas Internas / Preferencias de Servicio</label>
            <textarea
              name="notas_internas"
              value={formData.notas_internas}
              onChange={handleChange}
              rows={2}
              placeholder="Ej. Requiere factura CFDI 4.0 uso G03, autoriza por WhatsApp..."
              className={`${inputClasses} resize-y`}
            />
          </div>
        </div>
      </div>

      {/* Footer / Actions */}
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
          {loading ? "Guardando..." : initialData?.id ? "Actualizar Cliente" : "Guardar Cliente"}
        </button>
      </div>
    </form>
  );
}
