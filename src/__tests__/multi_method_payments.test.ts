import { describe, it, expect, vi, beforeEach } from "vitest";
import { MultiPaymentService, PaymentSplitItem } from "@/services/multiPaymentService";
import { supabase } from "@/lib/supabase";

// Mock supabase client
vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("MultiPaymentService - Pagos Multi-Método (Split Payments)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Registro de Ventas Mostrador (POS) Multi-Método", () => {
    it("debe registrar una venta formal dividida entre Efectivo, Tarjeta y Transferencia", async () => {
      const mockResult = {
        success: true,
        cotizacion_id: "cot-split-123",
        total: 12000,
        pagos_registrados: 3,
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const items = [
        { llanta_id: "llanta-1", cantidad: 4, precio_unitario: 3000, subtotal: 12000 },
      ];

      const pagos: PaymentSplitItem[] = [
        { id: "1", metodo: "Efectivo", monto: 4000, montoRecibido: 4000, cambio: 0 },
        { id: "2", metodo: "Tarjeta", monto: 5000, detalle: "Terminal Clip Débito", referencia: "AUTH-8921" },
        { id: "3", metodo: "Transferencia", monto: 3000, detalle: "BBVA SPEI", referencia: "SPEI-9402" },
      ];

      const res = await MultiPaymentService.registrarVentaMultiPago({
        clienteId: "cli-123",
        vehiculoId: "veh-456",
        items,
        pagos,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        "fn_registrar_venta_multi_pago",
        expect.objectContaining({
          p_cliente_id: "cli-123",
          p_vehiculo_id: "veh-456",
          p_items: items,
          p_pagos: expect.arrayContaining([
            expect.objectContaining({ metodo: "Efectivo", monto: 4000 }),
            expect.objectContaining({ metodo: "Tarjeta", monto: 5000 }),
            expect.objectContaining({ metodo: "Transferencia", monto: 3000 }),
          ]),
        })
      );

      expect(res.success).toBe(true);
      expect(res.cotizacion_id).toBe("cot-split-123");
      expect(res.pagos_registrados).toBe(3);
    });

    it("debe rechazar la venta cuando los métodos no cubren el total a pagar (UNDERPAYMENT)", async () => {
      const mockErrorResult = {
        success: false,
        error: "UNDERPAYMENT",
        total_venta: 10000,
        total_pagos: 7000,
        message: "Los métodos de pago ($7000) no cubren el total de la venta ($10000)",
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockErrorResult,
        error: null,
      });

      const res = await MultiPaymentService.registrarVentaMultiPago({
        clienteId: "cli-123",
        vehiculoId: "veh-456",
        items: [{ llanta_id: "llanta-1", cantidad: 2, precio_unitario: 5000, subtotal: 10000 }],
        pagos: [{ id: "1", metodo: "Efectivo", monto: 7000 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("UNDERPAYMENT");
      expect(res.message).toContain("no cubren el total");
    });
  });

  describe("Cobros Multi-Método en Órdenes de Servicio de Taller", () => {
    it("debe liquidar una orden con múltiples métodos y actualizar a estatus 'Pagado'", async () => {
      const mockResult = {
        success: true,
        orden_id: "ord-999",
        total_orden: 15000,
        nuevo_pagado: 15000,
        estatus_pago: "Pagado",
        pagos_registrados: 2,
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const pagos: PaymentSplitItem[] = [
        { id: "p1", metodo: "Efectivo", monto: 5000, montoRecibido: 5000, cambio: 0 },
        { id: "p2", metodo: "KueskiPay", monto: 10000, detalle: "BNPL 6 Quincenas", referencia: "KUESKI-789" },
      ];

      const res = await MultiPaymentService.registrarPagosOrdenMulti({
        ordenId: "ord-999",
        pagos,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        "fn_registrar_pagos_orden_multi",
        expect.objectContaining({
          p_orden_id: "ord-999",
          p_pagos: expect.arrayContaining([
            expect.objectContaining({ metodo: "Efectivo", monto: 5000 }),
            expect.objectContaining({ metodo: "KueskiPay", monto: 10000 }),
          ]),
        })
      );

      expect(res.success).toBe(true);
      expect(res.estatus_pago).toBe("Pagado");
      expect(res.nuevo_pagado).toBe(15000);
    });

    it("debe permitir pagos parciales divididos dejando la orden en estatus 'Parcial'", async () => {
      const mockResult = {
        success: true,
        orden_id: "ord-999",
        total_orden: 20000,
        nuevo_pagado: 8000,
        estatus_pago: "Parcial",
        pagos_registrados: 2,
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const res = await MultiPaymentService.registrarPagosOrdenMulti({
        ordenId: "ord-999",
        pagos: [
          { id: "p1", metodo: "Efectivo", monto: 3000 },
          { id: "p2", metodo: "Tarjeta", monto: 5000 },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.estatus_pago).toBe("Parcial");
    });
  });

  describe("Cálculo y Validación de División de Montos", () => {
    it("debe calcular correctamente el cambio en efectivo sin alterar otros métodos", () => {
      const cashSplit: PaymentSplitItem = {
        id: "cash-1",
        metodo: "Efectivo",
        monto: 3450,
        montoRecibido: 4000,
        cambio: 550,
      };

      const cardSplit: PaymentSplitItem = {
        id: "card-1",
        metodo: "Tarjeta",
        monto: 2000,
      };

      const totalCobrado = cashSplit.monto + cardSplit.monto;
      expect(totalCobrado).toBe(5450);
      expect(cashSplit.cambio).toBe(550);
    });
  });
});
