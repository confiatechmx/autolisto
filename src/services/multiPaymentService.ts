import { supabase } from "@/lib/supabase";

export type MetodoPagoTipo =
  | "Efectivo"
  | "Tarjeta"
  | "Transferencia"
  | "KueskiPay"
  | "Atrato"
  | "Mercado Pago"
  | "Stripe";

export interface PaymentSplitItem {
  id: string;
  metodo: MetodoPagoTipo;
  monto: number;
  montoRecibido?: number;
  cambio?: number;
  referencia?: string;
  detalle?: string;
  cuentaBancariaId?: string;
  cajaFondoId?: string;
}

export interface RegistrarVentaMultiParams {
  clienteId: string;
  vehiculoId: string;
  vendedorId?: string;
  sucursalId?: string | null;
  items: Array<{
    llanta_id: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  pagos: PaymentSplitItem[];
  serviciosAdicionales?: Array<{
    nombre: string;
    precio: number;
  }>;
}

export interface RegistrarPagosOrdenParams {
  ordenId: string;
  sucursalId?: string | null;
  pagos: PaymentSplitItem[];
}

export const MultiPaymentService = {
  /**
   * Registra una venta formal de mostrador (POS) con múltiples métodos de pago (Split Payment).
   * Ejecutado atómicamente en Supabase junto con deducción de stock y bitácora en pagos_orden.
   */
  async registrarVentaMultiPago(params: RegistrarVentaMultiParams): Promise<{
    success: boolean;
    cotizacion_id?: string;
    total?: number;
    pagos_registrados?: number;
    error?: string;
    message?: string;
  }> {
    try {
      const cleanVendedorId =
        params.vendedorId === "admin-demo-id" || !params.vendedorId
          ? "b001bc99-9c0b-4ef8-bb6d-6bb9bd380e51"
          : params.vendedorId;

      const formattedPagos = params.pagos.map((p) => ({
        metodo: p.metodo,
        monto: Number(p.monto || 0),
        monto_recibido: Number(p.montoRecibido || p.monto || 0),
        cambio: Number(p.cambio || 0),
        referencia: p.referencia?.trim() || null,
        detalle: p.detalle?.trim() || null,
        cuenta_bancaria_id: p.cuentaBancariaId || null,
        caja_fondo_id: p.cajaFondoId || null,
      }));

      const { data, error } = await supabase.rpc("fn_registrar_venta_multi_pago", {
        p_cliente_id: params.clienteId,
        p_vehiculo_id: params.vehiculoId,
        p_vendedor_id: cleanVendedorId,
        p_sucursal_id: params.sucursalId || undefined,
        p_items: params.items,
        p_pagos: formattedPagos,
        p_servicios_adicionales: params.serviciosAdicionales || [],
      });

      if (error) {
        return {
          success: false,
          error: error.code || "DB_ERROR",
          message: error.message || "Error al registrar la venta multi-método",
        };
      }

      return data as any;
    } catch (err: any) {
      return {
        success: false,
        error: "UNEXPECTED_ERROR",
        message: err?.message || "Error inesperado en cobro multi-método",
      };
    }
  },

  /**
   * Registra cobros con múltiples métodos de pago para una Orden de Servicio de taller.
   */
  async registrarPagosOrdenMulti(params: RegistrarPagosOrdenParams): Promise<{
    success: boolean;
    orden_id?: string;
    total_orden?: number;
    nuevo_pagado?: number;
    estatus_pago?: string;
    pagos_registrados?: number;
    error?: string;
    message?: string;
  }> {
    try {
      const formattedPagos = params.pagos.map((p) => ({
        metodo: p.metodo,
        monto: Number(p.monto || 0),
        monto_recibido: Number(p.montoRecibido || p.monto || 0),
        cambio: Number(p.cambio || 0),
        referencia: p.referencia?.trim() || null,
        detalle: p.detalle?.trim() || null,
        cuenta_bancaria_id: p.cuentaBancariaId || null,
        caja_fondo_id: p.cajaFondoId || null,
      }));

      const { data, error } = await supabase.rpc("fn_registrar_pagos_orden_multi", {
        p_orden_id: params.ordenId,
        p_sucursal_id: params.sucursalId || undefined,
        p_pagos: formattedPagos,
      });

      if (error) {
        return {
          success: false,
          error: error.code || "DB_ERROR",
          message: error.message || "Error al registrar pagos de la orden",
        };
      }

      return data as any;
    } catch (err: any) {
      return {
        success: false,
        error: "UNEXPECTED_ERROR",
        message: err?.message || "Error inesperado al registrar pagos",
      };
    }
  },
};
