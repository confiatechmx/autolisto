"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Trash2, Car, Disc, Gauge } from "lucide-react";

interface VehicleFormProps {
  clientId: string;
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const COMMON_OEM_SIZES = [
  "185/65 R15",
  "195/65 R15",
  "205/55 R16",
  "215/60 R16",
  "225/45 R17",
  "225/45 R18",
  "225/65 R17",
  "265/70 R17",
];

export function VehicleForm({ clientId, initialData, onSuccess, onCancel }: VehicleFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    marca: initialData?.marca || "",
    modelo: initialData?.modelo || "",
    anio: initialData?.anio?.toString() || new Date().getFullYear().toString(),
    placas: initialData?.placas || "",
    vin: initialData?.vin || "",
    color: initialData?.color || "",
    kilometraje_actual: (
      initialData?.kilometraje_actual ??
      initialData?.kilometraje ??
      0
    ).toString(),
    medida_oem: initialData?.medida_oem || "",
    presion_delantera_psi: initialData?.presion_delantera_psi?.toString() || "33",
    presion_trasera_psi: initialData?.presion_trasera_psi?.toString() || "33",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const upperFields = ["marca", "modelo", "placas", "vin", "medida_oem"];
    setFormData((prev) => ({
      ...prev,
      [name]: upperFields.includes(name) ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      cliente_id: clientId,
      marca: formData.marca.trim().toUpperCase(),
      modelo: formData.modelo.trim().toUpperCase(),
      anio: parseInt(formData.anio) || new Date().getFullYear(),
      placas: formData.placas ? formData.placas.trim().replace(/\s+/g, "-").toUpperCase() : null,
      vin: formData.vin ? formData.vin.trim().toUpperCase() : null,
      color: formData.color ? formData.color.trim() : null,
      kilometraje_actual: parseInt(formData.kilometraje_actual) || 0,
      medida_oem: formData.medida_oem ? formData.medida_oem.trim().toUpperCase() : null,
      presion_delantera_psi: formData.presion_delantera_psi
        ? parseInt(formData.presion_delantera_psi)
        : 33,
      presion_trasera_psi: formData.presion_trasera_psi
        ? parseInt(formData.presion_trasera_psi)
        : 33,
    };

    let dbError;
    const supabase = createClient();
    if (initialData?.id) {
      const { error: updErr } = await supabase
        .from("vehiculos")
        .update(payload)
        .eq("id", initialData.id);
      dbError = updErr;
    } else {
      const { error: insErr } = await supabase.from("vehiculos").insert(payload);
      dbError = insErr;
    }

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      onSuccess();
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (!window.confirm("¿Estás seguro de que deseas eliminar este vehículo del expediente?"))
      return;

    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("vehiculos")
      .delete()
      .eq("id", initialData.id);
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

        {/* Identificación del Vehículo */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Car size={14} className="text-blue-600" />
            Identificación de la Unidad
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className={labelClasses}>Marca *</label>
              <input
                required
                name="marca"
                value={formData.marca}
                onChange={handleChange}
                placeholder="Ej. NISSAN"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Modelo / Submarca *</label>
              <input
                required
                name="modelo"
                value={formData.modelo}
                onChange={handleChange}
                placeholder="Ej. NP300 FRONTIER"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Año Modelo *</label>
              <input
                required
                type="number"
                min="1960"
                max="2030"
                name="anio"
                value={formData.anio}
                onChange={handleChange}
                placeholder="Ej. 2022"
                className={`${inputClasses} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className={labelClasses}>Placas de Circulación</label>
              <input
                name="placas"
                value={formData.placas}
                onChange={handleChange}
                placeholder="Ej. RXY-482-A"
                className={`${inputClasses} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={labelClasses}>VIN (Número de Serie)</label>
              <input
                name="vin"
                value={formData.vin}
                onChange={handleChange}
                placeholder="17 caracteres..."
                maxLength={17}
                className={`${inputClasses} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={labelClasses}>Color Exterior</label>
              <input
                name="color"
                value={formData.color}
                onChange={handleChange}
                placeholder="Ej. Blanco Perlado"
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        {/* Telemetría y Especificación de Llantas OEM */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Disc size={14} className="text-blue-600" />
            Especificación de Llantas OEM y Odómetro
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelClasses}>Medida de Llanta Original (OEM)</label>
              <input
                name="medida_oem"
                value={formData.medida_oem}
                onChange={handleChange}
                placeholder="Ej. 225/45 R18"
                className={`${inputClasses} font-mono`}
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {COMMON_OEM_SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, medida_oem: sz }))}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                      formData.medida_oem === sz
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClasses}>
                <span className="inline-flex items-center gap-1">
                  <Gauge size={11} /> Kilometraje Actual (Odómetro)
                </span>
              </label>
              <div className="relative">
                <input
                  required
                  type="number"
                  min="0"
                  name="kilometraje_actual"
                  value={formData.kilometraje_actual}
                  onChange={handleChange}
                  className={`${inputClasses} font-mono pr-10`}
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-400">km</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelClasses}>Presión Recomendada Eje Delantero (PSI)</label>
              <div className="relative">
                <input
                  type="number"
                  min="15"
                  max="90"
                  name="presion_delantera_psi"
                  value={formData.presion_delantera_psi}
                  onChange={handleChange}
                  className={`${inputClasses} font-mono pr-12`}
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-400">PSI</span>
              </div>
            </div>
            <div>
              <label className={labelClasses}>Presión Recomendada Eje Trasero (PSI)</label>
              <div className="relative">
                <input
                  type="number"
                  min="15"
                  max="90"
                  name="presion_trasera_psi"
                  value={formData.presion_trasera_psi}
                  onChange={handleChange}
                  className={`${inputClasses} font-mono pr-12`}
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-400">PSI</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between gap-3 shrink-0 items-center">
        <div>
          {initialData?.id && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          )}
        </div>
        <div className="flex gap-2.5">
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
              ? "Actualizar Vehículo"
              : "Guardar Vehículo"}
          </button>
        </div>
      </div>
    </form>
  );
}
