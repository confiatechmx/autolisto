import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConcurrencyService } from "@/services/concurrencyService";
import { supabase } from "@/lib/supabase";

// Mock supabase client
vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("ConcurrencyService - Control de Concurrencia (Race Conditions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Ajuste Atómico de Stock (Bloqueo Pesimista)", () => {
    it("debe incrementar o decrementar stock exitosamente cuando hay disponibilidad", async () => {
      const mockResult = {
        success: true,
        llanta_id: "llanta-123",
        stock_anterior: 10,
        nuevo_stock: 8,
        delta: -2,
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const res = await ConcurrencyService.ajustarStock({
        llantaId: "llanta-123",
        delta: -2,
      });

      expect(supabase.rpc).toHaveBeenCalledWith("fn_ajustar_stock_llanta", {
        p_llanta_id: "llanta-123",
        p_cantidad_delta: -2,
        p_permitir_negativo: false,
      });
      expect(res.success).toBe(true);
      expect(res.nuevo_stock).toBe(8);
    });

    it("debe rechazar sobreventa cuando se intenta vender más piezas de las existentes", async () => {
      const mockResult = {
        success: false,
        error: "INSUFFICIENT_STOCK",
        stock_actual: 1,
        solicitado: 4,
        message: "Stock insuficiente para Michelin Pilot Sport 4",
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const res = await ConcurrencyService.ajustarStock({
        llantaId: "llanta-123",
        delta: -4,
        permitirNegativo: false,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("INSUFFICIENT_STOCK");
      expect(res.message).toContain("Stock insuficiente");
    });
  });

  describe("Descuento Masivo en Lote (fn_descontar_stock_orden)", () => {
    it("debe descontar múltiples neumáticos de forma atómica en una sola transacción", async () => {
      const items = [
        { llanta_id: "llanta-1", cantidad: 2 },
        { llanta_id: "llanta-2", cantidad: 4 },
      ];

      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, total_items: 2 },
        error: null,
      });

      const res = await ConcurrencyService.descontarStockLote(items);

      expect(supabase.rpc).toHaveBeenCalledWith("fn_descontar_stock_orden", {
        p_items: items,
      });
      expect(res.success).toBe(true);
      expect(res.total_items).toBe(2);
    });
  });

  describe("Concurrencia Optimista en Órdenes de Servicio", () => {
    it("debe actualizar la orden cuando la versión esperada coincide", async () => {
      const mockResult = {
        success: true,
        nuevo_version: 3,
        orden: { id: "orden-abc", version: 3, estado: "En Proceso" },
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const res = await ConcurrencyService.actualizarOrdenConcurrente({
        ordenId: "orden-abc",
        expectedVersion: 2,
        payload: { estado: "En Proceso" },
      });

      expect(supabase.rpc).toHaveBeenCalledWith("fn_actualizar_orden_concurrente", {
        p_orden_id: "orden-abc",
        p_expected_version: 2,
        p_payload: { estado: "En Proceso" },
      });
      expect(res.success).toBe(true);
      expect(res.nuevo_version).toBe(3);
    });

    it("debe retornar conflicto (conflict: true) si otro usuario modificó la versión", async () => {
      const mockResult = {
        success: false,
        conflict: true,
        current_version: 4,
        expected_version: 2,
        message: "Conflicto de concurrencia: La orden fue modificada recientemente por otro usuario.",
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const res = await ConcurrencyService.actualizarOrdenConcurrente({
        ordenId: "orden-abc",
        expectedVersion: 2,
        payload: { estado: "Listo" },
      });

      expect(res.success).toBe(false);
      expect(res.conflict).toBe(true);
      expect(res.current_version).toBe(4);
    });
  });

  describe("Idempotencia en Movimientos de Caja Chica", () => {
    it("debe registrar un movimiento nuevo con idempotencyKey", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, id: "mov-001", idempotent_replay: false },
        error: null,
      });

      const res = await ConcurrencyService.registrarMovimientoCaja({
        tipo: "Ingreso",
        concepto: "Pago de alineación",
        monto: 850,
        metodo: "Efectivo",
        idempotencyKey: "test-idemp-123",
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        "fn_registrar_movimiento_caja",
        expect.objectContaining({
          p_tipo: "Ingreso",
          p_concepto: "Pago de alineación",
          p_monto: 850,
          p_idempotency_key: "test-idemp-123",
        })
      );
      expect(res.success).toBe(true);
      expect(res.idempotent_replay).toBe(false);
    });

    it("debe detectar repetición idempotente por doble clic o reintento", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          success: true,
          id: "mov-001",
          idempotent_replay: true,
          message: "Movimiento ya registrado previamente",
        },
        error: null,
      });

      const res = await ConcurrencyService.registrarMovimientoCaja({
        tipo: "Ingreso",
        concepto: "Pago de alineación",
        monto: 850,
        idempotencyKey: "test-idemp-123",
      });

      expect(res.success).toBe(true);
      expect(res.idempotent_replay).toBe(true);
    });
  });
});
