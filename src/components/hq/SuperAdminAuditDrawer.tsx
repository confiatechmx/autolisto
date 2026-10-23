"use client";

import React, { useState, useEffect } from "react";
import { X, ShieldCheck, RefreshCw, FileText, Loader2 } from "lucide-react";
import { saasHqService, SuperAdminAuditLog } from "@/services/saasHqService";

interface SuperAdminAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SuperAdminAuditDrawer({ isOpen, onClose }: SuperAdminAuditDrawerProps) {
  if (!isOpen) return null;

  const [logs, setLogs] = useState<SuperAdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await saasHqService.getAuditLogs(50);
      setLogs(data);
    } catch (e) {
      console.error("Error cargando audit logs:", e);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (accion: string) => {
    if (accion.includes("IMPERSONATION")) {
      return (
        <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[10px] font-bold">
          SOPORTE IMP
        </span>
      );
    }
    if (accion.includes("SUSPENDED")) {
      return (
        <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold">
          KILL-SWITCH
        </span>
      );
    }
    if (accion.includes("REACTIVATED") || accion.includes("PAYMENT") || accion.includes("CREATED")) {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
          COBRO / ALTA
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold">
        {accion}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Bitácora de Control Plane (Audit Logs)</h3>
              <p className="text-[11px] text-slate-400">Auditoría inmutable de acciones administrativas y soporte</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Recargar bitácora"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Listado */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3 text-xs">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
              Cargando eventos de auditoría...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 text-slate-400 space-y-2">
              <FileText className="w-8 h-8 mx-auto opacity-40" />
              <p>No hay eventos registrados recientemente en la bitácora.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getActionBadge(log.accion)}
                    <span className="font-mono text-[11px] text-slate-300 font-semibold">{log.accion}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(log.created_at).toLocaleString("es-MX", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </span>
                </div>

                {log.detalles && Object.keys(log.detalles).length > 0 && (
                  <div className="bg-slate-900/90 rounded-lg p-2.5 text-[11px] font-mono border border-slate-800/50 text-slate-300 overflow-x-auto">
                    {Object.entries(log.detalles)
                      .filter(([k]) => !k.includes("raw_id"))
                      .map(([key, val]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-slate-500">{key}:</span>
                          <span className="text-slate-200">
                            {typeof val === "object" ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/40">
                  <span>ID: {log.id.slice(0, 8)}...</span>
                  <span>IP: {log.ip_address || "client"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
