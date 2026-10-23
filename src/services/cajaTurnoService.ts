import { supabase } from "@/lib/supabase";

export interface CajaFondo {
  id: string;
  empresa_id: string;
  sucursal_id: string | null;
  nombre: string;
  tipo: "OPERATIVO" | "RESERVA";
  saldo_actual: number;
  saldo_minimo_alerta: number | null;
  activo: boolean;
}

export interface CuentaBancaria {
  id: string;
  empresa_id: string;
  sucursal_id: string | null;
  banco: string;
  alias: string;
  titular: string | null;
  clabe: string | null;
  numero_cuenta: string | null;
  activo: boolean;
}

export interface DenominacionesConteo {
  b1000: number;
  b500: number;
  b200: number;
  b100: number;
  b50: number;
  b20: number;
  m20: number;
  m10: number;
  m5: number;
  m2: number;
  m1: number;
  centavos: number;
}

export interface CajaTurno {
  id: string;
  empresa_id: string;
  sucursal_id: string | null;
  usuario_apertura_id: string | null;
  usuario_cierre_id: string | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
  estado: "ABIERTO" | "CERRADO" | "AUDITADO";
  monto_apertura_fondo1: number;
  monto_apertura_fondo2: number;
  monto_cierre_declarado_f1: number | null;
  monto_cierre_declarado_f2: number | null;
  monto_cierre_teorico_f1: number | null;
  monto_cierre_teorico_f2: number | null;
  diferencia_f1: number | null;
  diferencia_f2: number | null;
  justificacion_descuadre: string | null;
  monto_remesa_retirada: number;
  monto_fondo_siguiente_f1: number;
  snapshot_resumen: any;
  created_at: string;
}

export interface ResumenTurnoTeorico {
  fondo1: {
    nombre: string;
    apertura: number;
    entradasEfectivoPOS: number;
    salidasGastos: number;
    traspasosRecibidos: number;
    traspasosEnviados: number;
    saldoTeoricoCalculado: number;
  };
  fondo2: {
    nombre: string;
    apertura: number;
    traspasosRecibidos: number;
    traspasosEnviados: number;
    saldoTeoricoCalculado: number;
  };
  bancosSPEI: Array<{
    cuentaId: string;
    banco: string;
    alias: string;
    total: number;
    conteo: number;
  }>;
  tarjetasTPV: {
    total: number;
    conteo: number;
  };
  bnpl: {
    total: number;
    conteo: number;
  };
  totalVentasTurno: number;
  cantidadTransacciones: number;
}

export const DENOMINACIONES_BASE: DenominacionesConteo = {
  b1000: 0,
  b500: 0,
  b200: 0,
  b100: 0,
  b50: 0,
  b20: 0,
  m20: 0,
  m10: 0,
  m5: 0,
  m2: 0,
  m1: 0,
  centavos: 0,
};

export function calcularTotalDenominaciones(d: DenominacionesConteo): number {
  return (
    (d.b1000 || 0) * 1000 +
    (d.b500 || 0) * 500 +
    (d.b200 || 0) * 200 +
    (d.b100 || 0) * 100 +
    (d.b50 || 0) * 50 +
    (d.b20 || 0) * 20 +
    (d.m20 || 0) * 20 +
    (d.m10 || 0) * 10 +
    (d.m5 || 0) * 5 +
    (d.m2 || 0) * 2 +
    (d.m1 || 0) * 1 +
    Number(d.centavos || 0)
  );
}

export const CajaTurnoService = {
  /**
   * Obtiene el turno actualmente ABIERTO para una sucursal
   */
  async obtenerTurnoActivo(sucursalId: string): Promise<CajaTurno | null> {
    try {
      const { data, error } = await supabase
        .from("caja_turnos")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .eq("estado", "ABIERTO")
        .order("fecha_apertura", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error al obtener turno activo:", error);
        return null;
      }

      return (data as CajaTurno) || null;
    } catch (err) {
      console.error("Excepción al consultar turno activo:", err);
      return null;
    }
  },

  /**
   * Obtiene los fondos (Fondo 1 Operativo y Fondo 2 Reserva) de la sucursal
   */
  async obtenerFondos(sucursalId: string, empresaId?: string): Promise<CajaFondo[]> {
    try {
      let query = supabase
        .from("caja_fondos")
        .select("*")
        .eq("activo", true);

      if (sucursalId) {
        query = query.eq("sucursal_id", sucursalId);
      } else if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query.order("tipo", { ascending: true });
      if (error) {
        console.error("Error al obtener fondos:", error);
        return [];
      }

      return (data as CajaFondo[]) || [];
    } catch (err) {
      console.error("Excepción al consultar fondos:", err);
      return [];
    }
  },

  /**
   * Obtiene las cuentas bancarias para cobros SPEI
   */
  async obtenerCuentasBancarias(empresaId: string, sucursalId?: string): Promise<CuentaBancaria[]> {
    try {
      let query = supabase
        .from("cuentas_bancarias")
        .select("*")
        .eq("activo", true);

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }
      if (sucursalId) {
        query = query.or(`sucursal_id.eq.${sucursalId},sucursal_id.is.null`);
      }

      const { data, error } = await query.order("alias", { ascending: true });
      if (error) {
        console.error("Error al obtener cuentas bancarias:", error);
        return [];
      }

      return (data as CuentaBancaria[]) || [];
    } catch (err) {
      console.error("Excepción al consultar cuentas bancarias:", err);
      return [];
    }
  },

  /**
   * Abre un nuevo turno de caja chica llamando a fn_abrir_turno_caja
   */
  async abrirTurno(params: {
    empresaId: string;
    sucursalId: string;
    usuarioId: string;
    montoFondo1: number;
    montoFondo2: number;
  }): Promise<{ success: boolean; turno_id?: string; error?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)("fn_abrir_turno_caja", {
        p_empresa_id: params.empresaId,
        p_sucursal_id: params.sucursalId,
        p_usuario_id: params.usuarioId,
        p_monto_fondo1: params.montoFondo1,
        p_monto_fondo2: params.montoFondo2,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: data?.success ?? true,
        turno_id: data?.turno_id,
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Error al abrir turno" };
    }
  },

  /**
   * Realiza un traspaso entre fondos (ej. Rescate de Fondo 2 Reserva a Fondo 1 Mostrador)
   */
  async traspasoEntreFondos(params: {
    turnoId: string;
    fondoOrigenId: string;
    fondoDestinoId: string;
    monto: number;
    concepto: string;
    usuarioId: string;
  }): Promise<{ success: boolean; traspaso_id?: string; error?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)("fn_traspaso_entre_fondos", {
        p_turno_id: params.turnoId,
        p_fondo_origen_id: params.fondoOrigenId,
        p_fondo_destino_id: params.fondoDestinoId,
        p_monto: params.monto,
        p_concepto: params.concepto,
        p_usuario_id: params.usuarioId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: data?.success ?? true,
        traspaso_id: data?.traspaso_id,
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Error al realizar traspaso" };
    }
  },

  /**
   * Calcula en tiempo real el desglose teórico de un turno activo
   */
  async calcularResumenTeorico(turno: CajaTurno, fondos: CajaFondo[], cuentas: CuentaBancaria[]): Promise<ResumenTurnoTeorico> {
    const f1 = fondos.find((f) => f.tipo === "OPERATIVO") || fondos[0];
    const f2 = fondos.find((f) => f.tipo === "RESERVA") || fondos[1];

    const f1Id = f1?.id;
    const f2Id = f2?.id;

    // 1. Pagos de ordenes durante el turno
    const { data: pagosData } = await supabase
      .from("pagos_orden")
      .select("*")
      .eq("sucursal_id", turno.sucursal_id)
      .eq("estatus", "COMPLETADO")
      .is("deleted_at", null)
      .gte("fecha_pago", turno.fecha_apertura);

    const pagos = pagosData || [];

    // 2. Movimientos de caja chica (Gastos / Insumos / etc.)
    const { data: movsData } = await supabase
      .from("caja_movimientos")
      .select("*")
      .eq("sucursal_id", turno.sucursal_id)
      .gte("created_at", turno.fecha_apertura);

    const movimientos = movsData || [];

    // 3. Traspasos entre fondos
    const { data: traspasosData } = await supabase
      .from("caja_traspasos_fondos")
      .select("*")
      .eq("turno_id", turno.id);

    const traspasos = traspasosData || [];

    // Desglose de Efectivo Fondo 1
    const entradasEfectivoPOS = pagos
      .filter((p) => p.proveedor_pago === "Efectivo" && (!p.caja_fondo_id || p.caja_fondo_id === f1Id))
      .reduce((sum, p) => sum + Number(p.monto_total || 0), 0);

    const salidasGastos = movimientos
      .filter((m) => ["Gasto / Insumos", "Pago Proveedor"].includes(m.tipo) && (!m.caja_fondo_id || m.caja_fondo_id === f1Id))
      .reduce((sum, m) => sum + Number(m.monto || 0), 0);

    const traspasosRecibidosF1 = traspasos
      .filter((t) => t.fondo_destino_id === f1Id)
      .reduce((sum, t) => sum + Number(t.monto || 0), 0);

    const traspasosEnviadosF1 = traspasos
      .filter((t) => t.fondo_origen_id === f1Id)
      .reduce((sum, t) => sum + Number(t.monto || 0), 0);

    const saldoTeoricoF1 =
      Number(turno.monto_apertura_fondo1 || 0) +
      entradasEfectivoPOS -
      salidasGastos +
      traspasosRecibidosF1 -
      traspasosEnviadosF1;

    // Desglose de Fondo 2 (Reserva)
    const traspasosRecibidosF2 = traspasos
      .filter((t) => t.fondo_destino_id === f2Id)
      .reduce((sum, t) => sum + Number(t.monto || 0), 0);

    const traspasosEnviadosF2 = traspasos
      .filter((t) => t.fondo_origen_id === f2Id)
      .reduce((sum, t) => sum + Number(t.monto || 0), 0);

    const saldoTeoricoF2 =
      Number(turno.monto_apertura_fondo2 || 0) + traspasosRecibidosF2 - traspasosEnviadosF2;

    // Desglose SPEI por cuenta bancaria
    const bancosSPEI = cuentas.map((cta) => {
      const pagosCta = pagos.filter(
        (p) =>
          ["Transferencia", "SPEI"].includes(p.proveedor_pago) &&
          (p.cuenta_bancaria_id === cta.id || (!p.cuenta_bancaria_id && cuentas[0]?.id === cta.id))
      );
      return {
        cuentaId: cta.id,
        banco: cta.banco,
        alias: cta.alias,
        total: pagosCta.reduce((acc, p) => acc + Number(p.monto_total || 0), 0),
        conteo: pagosCta.length,
      };
    });

    // Tarjetas TPV
    const pagosTPV = pagos.filter((p) =>
      ["Tarjeta", "Terminal", "TPV", "Mercado Pago", "Stripe"].includes(p.proveedor_pago)
    );
    const tarjetasTPV = {
      total: pagosTPV.reduce((acc, p) => acc + Number(p.monto_total || 0), 0),
      conteo: pagosTPV.length,
    };

    // BNPL
    const pagosBNPL = pagos.filter((p) => ["KueskiPay", "Atrato"].includes(p.proveedor_pago));
    const bnpl = {
      total: pagosBNPL.reduce((acc, p) => acc + Number(p.monto_total || 0), 0),
      conteo: pagosBNPL.length,
    };

    const totalVentasTurno = pagos.reduce((acc, p) => acc + Number(p.monto_total || 0), 0);

    return {
      fondo1: {
        nombre: f1?.nombre || "Fondo 1: Operativo Mostrador",
        apertura: Number(turno.monto_apertura_fondo1 || 0),
        entradasEfectivoPOS,
        salidasGastos,
        traspasosRecibidos: traspasosRecibidosF1,
        traspasosEnviados: traspasosEnviadosF1,
        saldoTeoricoCalculado: saldoTeoricoF1,
      },
      fondo2: {
        nombre: f2?.nombre || "Fondo 2: Reserva Taller",
        apertura: Number(turno.monto_apertura_fondo2 || 0),
        traspasosRecibidos: traspasosRecibidosF2,
        traspasosEnviados: traspasosEnviadosF2,
        saldoTeoricoCalculado: saldoTeoricoF2,
      },
      bancosSPEI,
      tarjetasTPV,
      bnpl,
      totalVentasTurno,
      cantidadTransacciones: pagos.length,
    };
  },

  /**
   * Cierra el turno de caja de forma atómica con conteo ciego
   */
  async cerrarTurno(params: {
    turnoId: string;
    usuarioCierreId: string;
    declaradoF1: number;
    declaradoF2: number;
    denominacionesF1?: DenominacionesConteo;
    denominacionesF2?: DenominacionesConteo;
    justificacion?: string;
    montoRemesa: number;
    montoFondoSiguiente: number;
  }): Promise<{
    success: boolean;
    diferenciaF1?: number;
    diferenciaF2?: number;
    teoricoF1?: number;
    teoricoF2?: number;
    error?: string;
  }> {
    try {
      const { data, error } = await (supabase.rpc as any)("fn_cerrar_turno_caja", {
        p_turno_id: params.turnoId,
        p_usuario_cierre_id: params.usuarioCierreId,
        p_declarado_f1: params.declaradoF1,
        p_declarado_f2: params.declaradoF2,
        p_denominaciones_f1: params.denominacionesF1 || null,
        p_denominaciones_f2: params.denominacionesF2 || null,
        p_justificacion: params.justificacion || "",
        p_monto_remesa: params.montoRemesa,
        p_monto_fondo_siguiente: params.montoFondoSiguiente,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: data?.success ?? true,
        diferenciaF1: data?.diferencia_f1,
        diferenciaF2: data?.diferencia_f2,
        teoricoF1: data?.teorico_f1,
        teoricoF2: data?.teorico_f2,
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Error al cerrar turno" };
    }
  },

  /**
   * Obtiene el historial de turnos cerrados para auditoría
   */
  async obtenerHistorialTurnos(sucursalId: string, limite = 15): Promise<CajaTurno[]> {
    try {
      const { data, error } = await supabase
        .from("caja_turnos")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .order("fecha_apertura", { ascending: false })
        .limit(limite);

      if (error) {
        console.error("Error al obtener historial de turnos:", error);
        return [];
      }

      return (data as CajaTurno[]) || [];
    } catch (err) {
      console.error("Excepción al consultar historial:", err);
      return [];
    }
  },
};
