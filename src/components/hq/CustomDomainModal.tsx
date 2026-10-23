"use client";

import React, { useState, useEffect } from "react";
import {
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Copy,
  Star,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { tenantDomainService, TenantDomainInfo } from "@/services/tenantDomainService";
import { toast } from "sonner";

interface CustomDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: string;
  empresaNombre: string;
  onSaved?: () => void;
}

export default function CustomDomainModal({
  isOpen,
  onClose,
  empresaId,
  empresaNombre,
  onSaved,
}: CustomDomainModalProps) {
  const [dominios, setDominios] = useState<TenantDomainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState<string | null>(null);
  const [dnsCheckResult, setDnsCheckResult] = useState<{ domain: string; ok: boolean; message: string } | null>(null);

  // Form para nuevo dominio
  const [nuevoDominio, setNuevoDominio] = useState("");
  const [appTitle, setAppTitle] = useState(empresaNombre);
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [sidebarColor, setSidebarColor] = useState("#0F172A");
  const [esPrincipal, setEsPrincipal] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (isOpen && empresaId) {
      cargarDominios();
      setAppTitle(empresaNombre);
      setDnsCheckResult(null);
    }
  }, [isOpen, empresaId, empresaNombre]);

  if (!isOpen) return null;

  const cargarDominios = async () => {
    try {
      setLoading(true);
      const list = await tenantDomainService.getDominiosEmpresa(empresaId);
      setDominios(list);
      if (list.length === 0) {
        setShowAddForm(true);
      }
    } catch (e: any) {
      toast.error("Error al cargar dominios de la empresa: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarDominio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoDominio.trim()) {
      toast.error("Ingresa un dominio o subdominio válido.");
      return;
    }

    try {
      setSaving(true);
      const clean = nuevoDominio.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      await tenantDomainService.registrarDominio(empresaId, clean, esPrincipal, {
        app_title: appTitle.trim() || empresaNombre,
        primary_color: primaryColor,
        sidebar_color: sidebarColor,
        logo_url: undefined,
        favicon_url: "/favicon.ico",
      });

      toast.success(`Dominio "${clean}" registrado correctamente`);
      setNuevoDominio("");
      setShowAddForm(false);
      await cargarDominios();
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error("Error al registrar dominio: " + (err.message || "Verifica los datos"));
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (domainId: string, domainName: string) => {
    if (!window.confirm(`¿Seguro que deseas desvincular el dominio "${domainName}" de ${empresaNombre}?`)) {
      return;
    }

    try {
      await tenantDomainService.eliminarDominio(domainId);
      toast.success(`Dominio "${domainName}" eliminado`);
      await cargarDominios();
      if (onSaved) onSaved();
    } catch (e: any) {
      toast.error("Error al eliminar dominio: " + e.message);
    }
  };

  const handleMarcarPrincipal = async (domainId: string) => {
    try {
      await tenantDomainService.marcarPrincipal(empresaId, domainId);
      toast.success("Dominio establecido como principal");
      await cargarDominios();
    } catch (e: any) {
      toast.error("Error al actualizar dominio principal: " + e.message);
    }
  };

  const handleVerificarDns = async (domainName: string) => {
    setCheckingDomain(domainName);
    setDnsCheckResult(null);
    try {
      const res = await tenantDomainService.verificarDnsEnVivo(domainName);
      setDnsCheckResult({ domain: domainName, ok: res.ok, message: res.message });
      if (res.ok) {
        toast.success("DNS verificado correctamente", { description: res.message });
      } else {
        toast.warning("Propagación DNS pendiente", { description: res.message });
      }
    } catch (e: any) {
      toast.error("Error verificando DNS: " + e.message);
    } finally {
      setCheckingDomain(null);
    }
  };

  const copiarPortapapeles = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success(`Copiado: "${texto}"`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Dominio Personalizado & Marca Blanca</h3>
              <p className="text-xs text-slate-400">Configuración institucional para {empresaNombre}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6 text-xs">
          {/* Instrucciones DNS */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Configuración DNS Requerida en tu Registrador (GoDaddy, Namecheap, Cloudflare)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono bg-slate-900/90 p-3 rounded-xl border border-slate-800/80">
              <div>
                <span className="text-slate-500 block text-[10px]">TIPO</span>
                <span className="text-white font-bold">CNAME</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">HOST / SUBDOMINIO</span>
                <span className="text-blue-400 font-bold">taller o app</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px]">VALOR DESTINO</span>
                  <span className="text-emerald-400 font-bold">cname.autolisto.mx</span>
                </div>
                <button
                  type="button"
                  onClick={() => copiarPortapapeles("cname.autolisto.mx")}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                  title="Copiar CNAME"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Listado de Dominios Existentes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                Dominios Vinculados ({dominios.length})
              </h4>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Dominio</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                Cargando dominios...
              </div>
            ) : dominios.length === 0 && !showAddForm ? (
              <div className="p-6 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 text-slate-400 space-y-1">
                <p>No hay dominios personalizados asociados aún.</p>
                <p className="text-[11px] text-slate-500">
                  Haz clic en &quot;Añadir Dominio&quot; para conectar la marca de tu taller.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {dominios.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{d.domain}</span>
                          {d.is_primary && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Principal
                            </span>
                          )}
                          {d.verified ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Verificado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                              Propagando
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Título: {d.custom_theme?.app_title || empresaNombre}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVerificarDns(d.domain)}
                        disabled={checkingDomain === d.domain}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Verificar CNAME en tiempo real"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingDomain === d.domain ? "animate-spin" : ""}`} />
                        <span>Verificar DNS</span>
                      </button>

                      {!d.is_primary && (
                        <button
                          onClick={() => handleMarcarPrincipal(d.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-800 text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                          title="Hacer dominio principal"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleEliminar(d.id, d.domain)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Eliminar dominio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resultado DNS Live */}
            {dnsCheckResult && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                  dnsCheckResult.ok
                    ? "bg-emerald-950/30 border-emerald-800 text-emerald-200"
                    : "bg-amber-950/30 border-amber-800 text-amber-200"
                }`}
              >
                {dnsCheckResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{dnsCheckResult.domain}</div>
                  <div className="text-[11px] opacity-90">{dnsCheckResult.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* Formulario Agregar Nuevo Dominio */}
          {showAddForm && (
            <form onSubmit={handleGuardarDominio} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs">Vincular Nuevo Dominio o Subdominio</span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Dominio (FQDN)
                  </label>
                  <input
                    type="text"
                    placeholder="taller.cova.com.mx"
                    value={nuevoDominio}
                    onChange={(e) => setNuevoDominio(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Título de la App (Branding)
                  </label>
                  <input
                    type="text"
                    placeholder={empresaNombre}
                    value={appTitle}
                    onChange={(e) => setAppTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Colores de Marca */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Color Primario
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Color Sidebar
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={sidebarColor}
                      onChange={(e) => setSidebarColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={sidebarColor}
                      onChange={(e) => setSidebarColor(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="esPrincipalCheck"
                  checked={esPrincipal}
                  onChange={(e) => setEsPrincipal(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 cursor-pointer"
                />
                <label htmlFor="esPrincipalCheck" className="text-slate-300 text-xs cursor-pointer">
                  Establecer como dominio institucional principal
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Guardar Dominio</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
