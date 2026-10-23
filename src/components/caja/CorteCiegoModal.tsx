"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Receipt,
  Calculator,
  Landmark,
  CreditCard,
  Banknote,
  Coins,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Smartphone,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  CajaTurnoService,
  CajaTurno,
  CajaFondo,
  CuentaBancaria,
  DenominacionesConteo,
  DENOMINACIONES_BASE,
  calcularTotalDenominaciones,
  ResumenTurnoTeorico,
} from "@/services/cajaTurnoService";

interface CorteCiegoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (closedShiftData?: any) => void;
  turnoActivo: CajaTurno;
  fondos: CajaFondo[];
  cuentasBancarias: CuentaBancaria[];
  usuarioId: string;
}

type StepType = "DENOMINACIONES" | "BANCOS_TPV" | "COMPARATIVA" | "REMESA";

export function CorteCiegoModal({
  isOpen,
  onClose,
  onSuccess,
  turnoActivo,
  fondos,
  cuentasBancarias,
  usuarioId,
}: CorteCiegoModalProps) {
  const fondoOperativo = fondos.find((f) => f.tipo === "OPERATIVO") || fondos[0];
  const fondoReserva = fondos.find((f) => f.tipo === "RESERVA") || fondos[1];

  const [step, setStep] = useState<StepType>("DENOMINACIONES");
  const [loadingResumen, setLoadingResumen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Theoretical calculated shift data
  const [resumenTeorico, setResumenTeorico] = useState<ResumenTurnoTeorico | null>(null);

  // Step 1: Blind Denominations for Fondo 1 (Operativo)
  const [denomF1, setDenomF1] = useState<DenominacionesConteo>({ ...DENOMINACIONES_BASE });
  // Total declared Fondo 2 (Reserva)
  const [montoF2Declarado, setMontoF2Declarado] = useState<string>(
    String(fondoReserva?.saldo_actual || turnoActivo.monto_apertura_fondo2 || 8000)
  );

  // Step 3: Justification for discrepancy
  const [justificacion, setJustificacion] = useState("");

  // Step 4: Cash drop / Remesa & Float for next shift
  const [fondoSiguiente, setFondoSiguiente] = useState<string>("1500");
  const [remesaRetirada, setRemesaRetirada] = useState<string>("0");

  // Load theoretical shift data on open
  useEffect(() => {
    if (!isOpen) return;
    setLoadingResumen(true);
    CajaTurnoService.calcularResumenTeorico(turnoActivo, fondos, cuentasBancarias)
      .then((data) => {
        setResumenTeorico(data);
      })
      .catch((err) => {
        console.error("Error al calcular resumen teórico:", err);
      })
      .finally(() => setLoadingResumen(false));
  }, [isOpen, turnoActivo, fondos, cuentasBancarias]);

  if (!isOpen) return null;

  // Physical cash counted by cashier for Fondo 1
  const totalF1Declarado = calcularTotalDenominaciones(denomF1);
  const totalF2Declarado = Number(montoF2Declarado || 0);

  // Variances
  const teoricoF1 = resumenTeorico?.fondo1.saldoTeoricoCalculado ?? Number(turnoActivo.monto_apertura_fondo1);
  const teoricoF2 = resumenTeorico?.fondo2.saldoTeoricoCalculado ?? Number(turnoActivo.monto_apertura_fondo2);

  const diferenciaF1 = totalF1Declarado - teoricoF1;
  const diferenciaF2 = totalF2Declarado - teoricoF2;

  // Auto calculate remesa when entering Step 4
  const handleGoToRemesa = () => {
    const fSiguienteNum = Number(fondoSiguiente || 1500);
    const remesaSugerida = Math.max(0, totalF1Declarado - fSiguienteNum);
    setRemesaRetirada(String(remesaSugerida));
    setStep("REMESA");
  };

  const handleDenomChange = (field: keyof DenominacionesConteo, value: string) => {
    const num = field === "centavos" ? parseFloat(value) || 0 : parseInt(value, 10) || 0;
    setDenomF1((prev) => ({
      ...prev,
      [field]: Math.max(0, num),
    }));
  };

  const handleCerrarTurno = async () => {
    setErrorMsg(null);
    const fSiguienteNum = Number(fondoSiguiente || 0);
    const remesaNum = Number(remesaRetirada || 0);

    // Tolerance check
    const hayDescuadreSignificativo = Math.abs(diferenciaF1) > 10 || Math.abs(diferenciaF2) > 10;
    if (hayDescuadreSignificativo && !justificacion.trim()) {
      setErrorMsg("Es obligatorio ingresar una justificación detallada para el descuadre");
      setStep("COMPARATIVA");
      return;
    }

    setSubmitting(true);
    try {
      const res = await CajaTurnoService.cerrarTurno({
        turnoId: turnoActivo.id,
        usuarioCierreId: usuarioId,
        declaradoF1: totalF1Declarado,
        declaradoF2: totalF2Declarado,
        denominacionesF1: denomF1,
        justificacion: justificacion.trim(),
        montoRemesa: remesaNum,
        montoFondoSiguiente: fSiguienteNum,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Error al registrar el cierre del turno");
        setSubmitting(false);
        return;
      }

      onSuccess({
        ...res,
        declaradoF1: totalF1Declarado,
        declaradoF2: totalF2Declarado,
        diferenciaF1,
        diferenciaF2,
        remesa: remesaNum,
        fondoSiguiente: fSiguienteNum,
        resumenTeorico,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Excepción al procesar cierre");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 md:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
              <Receipt size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Corte Z Definitivo
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-300">Turno Activo</span>
              </div>
              <h2 className="text-base md:text-lg font-bold">
                Motor de Cierre y Arqueo Ciego de Caja
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold overflow-x-auto gap-2">
          <button
            onClick={() => setStep("DENOMINACIONES")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              step === "DENOMINACIONES"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calculator size={14} /> 1. Conteo Ciego
          </button>
          <ChevronRight size={14} className="text-slate-300 shrink-0" />
          <button
            onClick={() => setStep("BANCOS_TPV")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              step === "BANCOS_TPV"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Landmark size={14} /> 2. SPEI & TPVs
          </button>
          <ChevronRight size={14} className="text-slate-300 shrink-0" />
          <button
            onClick={() => setStep("COMPARATIVA")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              step === "COMPARATIVA"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldCheck size={14} /> 3. Arqueo y Desviaciones
          </button>
          <ChevronRight size={14} className="text-slate-300 shrink-0" />
          <button
            onClick={() => setStep("REMESA")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              step === "REMESA"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Banknote size={14} /> 4. Remesa y Finalizar
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 shrink-0">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 1: CONTEO CIEGO POR DENOMINACIONES                          */}
          {/* ================================================================ */}
          {step === "DENOMINACIONES" && (
            <div className="flex flex-col gap-5">
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3">
                <EyeOff size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <span className="font-bold block">Protocolo de Conteo Ciego:</span>
                  Cuenta y captura físicamente los billetes y monedas que tienes en gaveta. El
                  saldo teórico del sistema permanece oculto en esta etapa para evitar sesgos.
                </div>
              </div>

              {/* Fondo 1: Desglose por Billetes y Monedas */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Banknote size={16} className="text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Fondo 1: Operativo (Mostrador)
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Total Contado:
                    </span>
                    <span className="text-base font-bold text-slate-900 ml-2 tabular-nums">
                      ${totalF1Declarado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Billetes Grid */}
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-2">
                    Billetes (Piezas)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    {[
                      { key: "b1000", label: "$1,000", val: 1000 },
                      { key: "b500", label: "$500", val: 500 },
                      { key: "b200", label: "$200", val: 200 },
                      { key: "b100", label: "$100", val: 100 },
                      { key: "b50", label: "$50", val: 50 },
                      { key: "b20", label: "$20", val: 20 },
                    ].map((b) => (
                      <div key={b.key} className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col">
                        <span className="text-[11px] font-bold text-slate-700">{b.label}</span>
                        <input
                          type="number"
                          min="0"
                          value={denomF1[b.key as keyof DenominacionesConteo] || ""}
                          onChange={(e) => handleDenomChange(b.key as any, e.target.value)}
                          placeholder="0"
                          className="mt-1 w-full text-center py-1 font-bold text-sm bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-primary focus:outline-hidden"
                        />
                        <span className="text-[10px] text-slate-400 text-right mt-1 tabular-nums">
                          ${((denomF1[b.key as keyof DenominacionesConteo] || 0) * b.val).toLocaleString("es-MX")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monedas Grid */}
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-2">
                    Monedas (Piezas / Centavos)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    {[
                      { key: "m20", label: "$20", val: 20 },
                      { key: "m10", label: "$10", val: 10 },
                      { key: "m5", label: "$5", val: 5 },
                      { key: "m2", label: "$2", val: 2 },
                      { key: "m1", label: "$1", val: 1 },
                    ].map((m) => (
                      <div key={m.key} className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col">
                        <span className="text-[11px] font-bold text-slate-700">{m.label}</span>
                        <input
                          type="number"
                          min="0"
                          value={denomF1[m.key as keyof DenominacionesConteo] || ""}
                          onChange={(e) => handleDenomChange(m.key as any, e.target.value)}
                          placeholder="0"
                          className="mt-1 w-full text-center py-1 font-bold text-sm bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-primary focus:outline-hidden"
                        />
                        <span className="text-[10px] text-slate-400 text-right mt-1 tabular-nums">
                          ${((denomF1[m.key as keyof DenominacionesConteo] || 0) * m.val).toLocaleString("es-MX")}
                        </span>
                      </div>
                    ))}

                    {/* Centavos */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">Centavos ($)</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={denomF1.centavos || ""}
                        onChange={(e) => handleDenomChange("centavos", e.target.value)}
                        placeholder="0.00"
                        className="mt-1 w-full text-center py-1 font-bold text-sm bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-primary focus:outline-hidden"
                      />
                      <span className="text-[10px] text-slate-400 text-right mt-1 tabular-nums">
                        ${Number(denomF1.centavos || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fondo 2: Conteo Físico de Reserva */}
              <div className="border border-purple-200 rounded-2xl p-4 bg-purple-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Coins size={16} className="text-purple-600" />
                    <h3 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                      Fondo 2: Reserva Taller (Caja Fuerte)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Verifica el efectivo en el sobre o compartimento de resguardo secundario.
                  </p>
                </div>
                <div className="relative w-full sm:w-48">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-purple-400 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={montoF2Declarado}
                    onChange={(e) => setMontoF2Declarado(e.target.value)}
                    placeholder="8000.00"
                    className="w-full pl-8 pr-4 py-2 bg-white border border-purple-200 rounded-xl text-slate-900 font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>

              {/* Total Declared Bar */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Total de Efectivo Físico Declarado (Fondo 1 + Fondo 2):
                </span>
                <span className="text-lg font-bold text-emerald-400 tabular-nums">
                  ${(totalF1Declarado + totalF2Declarado).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                </span>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 2: CONCILIACIÓN ESPEJO DE CUENTAS SPEI & TPVS               */}
          {/* ================================================================ */}
          {step === "BANCOS_TPV" && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Conciliación de Transferencias SPEI (3 Cuentas) y Pasarelas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifica estos montos contra tus aplicaciones bancarias y los vouchers de terminal física.
                </p>
              </div>

              {/* Cuentas Bancarias SPEI Espejo */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark size={16} className="text-blue-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Desglose de Transferencias SPEI por Cuenta
                    </span>
                  </div>
                  <span className="text-xs font-bold text-blue-700">
                    Total: $
                    {resumenTeorico?.bancosSPEI
                      .reduce((acc, b) => acc + b.total, 0)
                      .toLocaleString("es-MX", { minimumFractionDigits: 2 }) || "0.00"}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {resumenTeorico?.bancosSPEI && resumenTeorico.bancosSPEI.length > 0 ? (
                    resumenTeorico.bancosSPEI.map((banco) => (
                      <div
                        key={banco.cuentaId}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {banco.banco.substring(0, 3)}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              {banco.alias}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {banco.banco} • {banco.conteo} transferencia{banco.conteo !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                          ${banco.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No se registraron transferencias SPEI en este turno.
                    </div>
                  )}
                </div>
              </div>

              {/* Terminales y Pasarelas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* TPV */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900">
                        Terminales TPV (Tarjetas)
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {resumenTeorico?.tarjetasTPV.conteo || 0} vouchers
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">
                      $
                      {resumenTeorico?.tarjetasTPV.total.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      }) || "0.00"}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Cotejar contra el cierre de lote de Clip / Mercado Pago
                    </p>
                  </div>
                </div>

                {/* BNPL */}
                <div className="p-4 bg-white border border-purple-200 rounded-2xl flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone size={16} className="text-purple-600" />
                      <span className="text-xs font-bold text-purple-950">
                        BNPL (Kueski / Atrato)
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      {resumenTeorico?.bnpl.conteo || 0} créditos
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-xl font-bold text-purple-950 tabular-nums">
                      $
                      {resumenTeorico?.bnpl.total.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      }) || "0.00"}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dispuesto en plataforma financiera
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 3: ARQUEO Y COMPARATIVA (DESVIACIONES)                       */}
          {/* ================================================================ */}
          {step === "COMPARATIVA" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Comparativa de Arqueo: Físico vs Teórico en Sistema
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Detección automática de faltantes o sobrantes por fondo.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  <Eye size={14} /> Teórico Revelado
                </div>
              </div>

              {/* Fondo 1 Comparativa */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-900">
                    Fondo 1: Operativo (Mostrador)
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      Math.abs(diferenciaF1) <= 10
                        ? "bg-emerald-100 text-emerald-800"
                        : diferenciaF1 > 0
                        ? "bg-blue-100 text-blue-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {Math.abs(diferenciaF1) <= 10
                      ? "✓ Cuadrado"
                      : diferenciaF1 > 0
                      ? `+ Sobrante $${diferenciaF1.toFixed(2)}`
                      : `- Faltante $${Math.abs(diferenciaF1).toFixed(2)}`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">
                      Teórico Sistema
                    </span>
                    <span className="font-bold text-slate-700 tabular-nums text-sm">
                      ${teoricoF1.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">
                      Físico Contado
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums text-sm">
                      ${totalF1Declarado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl ${
                      Math.abs(diferenciaF1) <= 10
                        ? "bg-emerald-50 text-emerald-700"
                        : diferenciaF1 > 0
                        ? "bg-blue-50 text-blue-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase">Variación</span>
                    <span className="font-bold tabular-nums text-sm">
                      {diferenciaF1 > 0 ? "+" : ""}${diferenciaF1.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Sub-breakdown details */}
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-slate-100">
                  <span>Apertura: ${Number(turnoActivo.monto_apertura_fondo1).toFixed(2)}</span>
                  <span>Cobros POS: +${resumenTeorico?.fondo1.entradasEfectivoPOS.toFixed(2)}</span>
                  <span>Gastos Gaveta: -${resumenTeorico?.fondo1.salidasGastos.toFixed(2)}</span>
                  <span>Traspasos Netos: +${((resumenTeorico?.fondo1.traspasosRecibidos || 0) - (resumenTeorico?.fondo1.traspasosEnviados || 0)).toFixed(2)}</span>
                </div>
              </div>

              {/* Fondo 2 Comparativa */}
              <div className="p-4 bg-white border border-purple-200 rounded-2xl shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                  <span className="text-xs font-bold text-purple-950">
                    Fondo 2: Reserva Taller
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      Math.abs(diferenciaF2) <= 10
                        ? "bg-emerald-100 text-emerald-800"
                        : diferenciaF2 > 0
                        ? "bg-blue-100 text-blue-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {Math.abs(diferenciaF2) <= 10
                      ? "✓ Cuadrado"
                      : diferenciaF2 > 0
                      ? `+ Sobrante $${diferenciaF2.toFixed(2)}`
                      : `- Faltante $${Math.abs(diferenciaF2).toFixed(2)}`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">
                      Teórico Reserva
                    </span>
                    <span className="font-bold text-slate-700 tabular-nums text-sm">
                      ${teoricoF2.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">
                      Físico Contado
                    </span>
                    <span className="font-bold text-purple-950 tabular-nums text-sm">
                      ${totalF2Declarado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl ${
                      Math.abs(diferenciaF2) <= 10
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase">Variación</span>
                    <span className="font-bold tabular-nums text-sm">
                      {diferenciaF2 > 0 ? "+" : ""}${diferenciaF2.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Justificación obligatoria si hay descuadre */}
              {(Math.abs(diferenciaF1) > 10 || Math.abs(diferenciaF2) > 10) && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <AlertTriangle size={16} />
                    <span>Justificación Obligatoria del Descuadre</span>
                  </div>
                  <p className="text-xs text-rose-700">
                    Existe una discrepancia superior al margen de tolerancia ($10.00 MXN). Describe el
                    motivo (ej. ticket extraviado de refacciones, cobro incorrecto de cambio, etc.):
                  </p>
                  <textarea
                    rows={2}
                    required
                    value={justificacion}
                    onChange={(e) => setJustificacion(e.target.value)}
                    placeholder="Escribe la justificación para la auditoría..."
                    className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 4: REMESA Y DESTINO DEL EFECTIVO                            */}
          {/* ================================================================ */}
          {step === "REMESA" && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Destino del Efectivo: Remesa de Utilidad y Fondo para Mañana
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Protege al taller evitando acumular excedente de efectivo en el mostrador.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fondo para el siguiente turno */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Banknote size={16} className="text-emerald-600" />
                    Fondo para Mañana (Caja Chica)
                  </span>
                  <p className="text-xs text-slate-500">
                    Monto que se dejará en la gaveta física para iniciar el siguiente turno.
                  </p>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={fondoSiguiente}
                      onChange={(e) => {
                        setFondoSiguiente(e.target.value);
                        const fs = Number(e.target.value || 0);
                        setRemesaRetirada(String(Math.max(0, totalF1Declarado - fs)));
                      }}
                      className="w-full pl-7 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Remesa a Caja Fuerte / Depósito */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex flex-col gap-2">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    Remesa / Retiro a Depósito
                  </span>
                  <p className="text-xs text-slate-500">
                    Efectivo a retirar en sobre hacia la caja fuerte o depósito bancario.
                  </p>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-emerald-600 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={remesaRetirada}
                      onChange={(e) => setRemesaRetirada(e.target.value)}
                      className="w-full pl-7 pr-4 py-2 bg-white border border-emerald-200 rounded-xl font-bold text-sm text-emerald-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Total Balance Check */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>Efectivo Total Contado en Mostrador:</span>
                  <span className="font-bold text-white tabular-nums">
                    ${totalF1Declarado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>(-) Se queda en cajón para mañana:</span>
                  <span className="font-bold text-amber-300 tabular-nums">
                    -${Number(fondoSiguiente || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-bold">
                  <span className="text-emerald-400">(=) Sobre de Remesa a Guardar:</span>
                  <span className="text-emerald-400 tabular-nums text-base">
                    ${Number(remesaRetirada || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 md:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {step === "DENOMINACIONES" && (
              <button
                type="button"
                onClick={() => setStep("BANCOS_TPV")}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
              >
                <span>Revisar Cuentas Bancarias & TPVs</span>
                <ArrowRight size={14} />
              </button>
            )}

            {step === "BANCOS_TPV" && (
              <>
                <button
                  type="button"
                  onClick={() => setStep("DENOMINACIONES")}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Regresar
                </button>
                <button
                  type="button"
                  onClick={() => setStep("COMPARATIVA")}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
                >
                  <span>Comparar Teórico y Variación</span>
                  <ArrowRight size={14} />
                </button>
              </>
            )}

            {step === "COMPARATIVA" && (
              <>
                <button
                  type="button"
                  onClick={() => setStep("BANCOS_TPV")}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Regresar
                </button>
                <button
                  type="button"
                  onClick={handleGoToRemesa}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
                >
                  <span>Definir Remesa y Cierre</span>
                  <ArrowRight size={14} />
                </button>
              </>
            )}

            {step === "REMESA" && (
              <>
                <button
                  type="button"
                  onClick={() => setStep("COMPARATIVA")}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Regresar
                </button>
                <button
                  type="button"
                  onClick={handleCerrarTurno}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Cerrando Turno y Congelando Snapshot...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Finalizar Corte Z y Cerrar Turno
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
