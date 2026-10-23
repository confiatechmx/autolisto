import { supabase } from "@/lib/supabase";

export interface StockAdjustmentResult {
  success: boolean;
  llanta_id?: string;
  stock_anterior?: number;
  nuevo_stock?: number;
  delta?: number;
  error?: string;
  message?: string;
  stock_actual?: number;
  solicitado?: number;
}

export interface ConcurrencyOrderResult {
  success: boolean;
  conflict?: boolean;
  current_version?: number;
  expected_version?: number;
  nuevo_version?: number;
  orden?: any;
  error?: string;
  message?: string;
}

export interface CajaMovimientoResult {
  success: boolean;
  id?: string;
  idempotent_replay?: boolean;
  error?: string;
  message?: string;
}

/**
 * Servicio Centralizado de Control de Concurrencia (Race Conditions)
 * Proporciona bloqueos pesimistas en BD, control optimista de versiones e idempotencia.
 */
export const ConcurrencyService = {
  /**
   * Ajusta atómicamente el stock de un neumático previniendo race conditions y sobreventas.
   * Utiliza SELECT ... FOR UPDATE en Supabase.
   */
  async ajustarStock(params: {
    llantaId: string;
    delta: number;
    permitirNegativo?: boolean;
  }): Promise<StockAdjustmentResult> {
    try {
      const { data, error } = await supabase.rpc("fn_ajustar_stock_llanta", {
        p_llanta_id: params.llantaId,
        p_cantidad_delta: params.delta,
        p_permitir_negativo: params.permitirNegativo ?? false,
      });

      if (error) {
        return {
          success: false,
          error: error.code || "DB_ERROR",
          message: error.message || "Error al actualizar stock de neumático",
        };
      }

      return data as unknown as StockAdjustmentResult;
    } catch (err: any) {
      return {
        success: false,
        error: "UNEXPECTED_ERROR",
        message: err?.message || "Error inesperado en ajuste de stock",
      };
    }
  },

  /**
   * Descuenta stock en lote para órdenes o cotizaciones aprobadas.
   * Ordena los IDs para prevenir bloqueos mutuos (deadlocks).
   */
  async descontarStockLote(
    items: Array<{ llanta_id: string; cantidad: number }>
  ): Promise<{ success: boolean; total_items?: number; error?: string; message?: string }> {
    try {
      const { data, error } = await supabase.rpc("fn_descontar_stock_orden", {
        p_items: items,
      });

      if (error) {
        return {
          success: false,
          error: error.code || "DB_ERROR",
          message: error.message || "Error al descontar stock en lote",
        };
      }

      return data as any;
    } catch (err: any) {
      return {
        success: false,
        error: "UNEXPECTED_ERROR",
        message: err?.message || "Error inesperado al descontar inventario",
      };
    }
  },

  /**
   * Actualiza una orden de trabajo con bloqueo optimista.
   * Si otro usuario modificó la orden previamente, retorna conflict = true.
   */
  async actualizarOrdenConcurrente(params: {
    ordenId: string;
    expectedVersion: number;
    payload: Record<string, any>;
  }): Promise<ConcurrencyOrderResult> {
    try {
      const { data, error } = await supabase.rpc("fn_actualizar_orden_concurrente", {
        p_orden_id: params.ordenId,
        p_expected_version: params.expectedVersion,
        p_payload: params.payload,
      });

      if (error) {
        return {
          success: false,
          error: error.code || "DB_ERROR",
          message: error.message || "Error al actualizar orden concurrente",
        };
      }

      return data as unknown as ConcurrencyOrderResult;
    } catch (err: any) {
      return {
        success: false,
        error: "UNEXPECTED_ERROR",
        message: err?.message || "Error inesperado al actualizar orden",
      };
    }
  },

  /**
   * Registra un movimiento de caja chica con clave de idempotencia.
   * Evita duplicación de movimientos por doble clic o reintentos de red.
   */
  async registrarMovimientoCaja(params: {
    tipo: string;
    concepto: string;
    monto: number;
    metodo?: string;
    responsable?: string;
    sucursalId?: string | null;
    idempotencyKey?: string;
  }): Promise<CajaMovimientoResult> {
    try {
      const idempotencyKey =
        params.idempotencyKey ||
        `caja-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const { data, error } = await supabase.rpc("fn_registrar_movimiento_caja", {
        p_tipo: params.tipo,
        p_concepto: params.concepto,
        p_monto: params.monto,
        p_metodo: params.metodo || "Efectivo",
        p_responsable: params.responsable || "Caja General",
        p_sucursal_id: params.sucursalId || undefined,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        return {
          success: false,
          error: error.code || "DB_ERROR",
          message: error.message || "Error al registrar movimiento en caja",
        };
      }

      return data as unknown as CajaMovimientoResult;
    } catch (err: any) {
      return {
        success: false,
        error: "UNEXPECTED_ERROR",
        message: err?.message || "Error inesperado en caja chica",
      };
    }
  },
};
