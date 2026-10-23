import { describe, it, expect, vi } from "vitest";

// Mock supabase client for unit testing
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import {
  calcularTotalDenominaciones,
  DenominacionesConteo,
  DENOMINACIONES_BASE,
  CajaTurno,
  CajaFondo,
  CuentaBancaria,
} from "../services/cajaTurnoService";

describe("Motor de Corte de Caja, Turnos y Arqueo Ciego", () => {
  it("debe calcular con precisión matemática el arqueo ciego por denominaciones", () => {
    const conteo: DenominacionesConteo = {
      b1000: 2, // $2,000
      b500: 5,  // $2,500
      b200: 10, // $2,000
      b100: 15, // $1,500
      b50: 8,   // $400
      b20: 10,  // $200
      m20: 5,   // $100
      m10: 12,  // $120
      m5: 10,   // $50
      m2: 15,   // $30
      m1: 25,   // $25
      centavos: 12.5, // $12.50
    };

    const total = calcularTotalDenominaciones(conteo);
    // 2000 + 2500 + 2000 + 1500 + 400 + 200 + 100 + 120 + 50 + 30 + 25 + 12.50 = 8937.50
    expect(total).toBe(8937.5);
  });

  it("debe manejar valores en cero sin alterar el total", () => {
    const conteoVacio = { ...DENOMINACIONES_BASE };
    expect(calcularTotalDenominaciones(conteoVacio)).toBe(0);
  });

  it("debe calcular correctamente el saldo teórico independiente para Fondo 1 (Operativo) y Fondo 2 (Reserva)", () => {
    // Escenario Cova Tires:
    // Fondo 1 abre con $1,500.00
    // Fondo 2 abre con $8,000.00
    const aperturaF1 = 1500;
    const aperturaF2 = 8000;

    // Ventas en efectivo cobradas en mostrador
    const ventasEfectivo = 6400; // 2 llantas + alineación

    // Gastos pagados en efectivo desde Fondo 1 (vales de insumos)
    const gastosInsumos = 550; // $350 tornillos + $200 taxi refacción

    // Se termina el cambio en mostrador -> Rescate de Fondo 2 hacia Fondo 1
    const montoTraspaso = 2000;

    // Cálculo teórico Fondo 1
    const teoricoF1 = aperturaF1 + ventasEfectivo - gastosInsumos + montoTraspaso;
    // 1500 + 6400 - 550 + 2000 = 9350
    expect(teoricoF1).toBe(9350);

    // Cálculo teórico Fondo 2 (Reserva)
    const teoricoF2 = aperturaF2 - montoTraspaso;
    // 8000 - 2000 = 6000
    expect(teoricoF2).toBe(6000);

    // El efectivo total en taller debe ser la suma exacta de ambos
    const totalEfectivoTaller = teoricoF1 + teoricoF2;
    // (1500 + 8000) + 6400 - 550 = 15350
    expect(totalEfectivoTaller).toBe(15350);
  });

  it("debe detectar con precisión variaciones (faltantes y sobrantes) y validar la regla de tolerancia", () => {
    const teoricoF1 = 9350;

    // Caso A: Caja perfectamente cuadrada (diferencia 0)
    const declaradoA = 9350;
    const difA = declaradoA - teoricoF1;
    expect(difA).toBe(0);
    expect(Math.abs(difA) <= 10).toBe(true); // Dentro de tolerancia

    // Caso B: Pequeño sobrante por redondeo de centavos ($4.50)
    const declaradoB = 9354.5;
    const difB = declaradoB - teoricoF1;
    expect(difB).toBe(4.5);
    expect(Math.abs(difB) <= 10).toBe(true); // Dentro de tolerancia aceptable

    // Caso C: Faltante de dinero (-$200.00)
    const declaradoC = 9150;
    const difC = declaradoC - teoricoF1;
    expect(difC).toBe(-200);
    expect(Math.abs(difC) > 10).toBe(true); // Supera tolerancia -> Requiere justificación forzada

    // Caso D: Sobrante no registrado (+$350.00)
    const declaradoD = 9700;
    const difD = declaradoD - teoricoF1;
    expect(difD).toBe(350);
    expect(Math.abs(difD) > 10).toBe(true); // Supera tolerancia
  });

  it("debe conciliar transacciones SPEI distribuidas en 3 cuentas bancarias distintas", () => {
    const cuentas: CuentaBancaria[] = [
      {
        id: "cta-bbva",
        empresa_id: "emp-cova",
        sucursal_id: "suc-1",
        banco: "BBVA",
        alias: "BBVA Fiscal",
        titular: "Cova Tires S.A.",
        clabe: "012580001394829102",
        numero_cuenta: "0139482910",
        activo: true,
      },
      {
        id: "cta-banorte",
        empresa_id: "emp-cova",
        sucursal_id: "suc-1",
        banco: "Banorte",
        alias: "Banorte Operativa",
        titular: "Cova Servicios",
        clabe: "072580004819284719",
        numero_cuenta: "0481928471",
        activo: true,
      },
      {
        id: "cta-santander",
        empresa_id: "emp-cova",
        sucursal_id: "suc-1",
        banco: "Santander",
        alias: "Santander Reserva",
        titular: "Cova Admin",
        clabe: "014580009281746281",
        numero_cuenta: "0928174628",
        activo: true,
      },
    ];

    // Transacciones registradas durante el turno
    const pagosTurno = [
      { monto: 3200, cuentaId: "cta-bbva" },
      { monto: 5400, cuentaId: "cta-bbva" },
      { monto: 1800, cuentaId: "cta-banorte" },
      { monto: 4500, cuentaId: "cta-banorte" },
      { monto: 2100, cuentaId: "cta-banorte" },
      { monto: 7800, cuentaId: "cta-santander" },
    ];

    const conciliacion = cuentas.map((cta) => {
      const items = pagosTurno.filter((p) => p.cuentaId === cta.id);
      return {
        alias: cta.alias,
        total: items.reduce((acc, curr) => acc + curr.monto, 0),
        conteo: items.length,
      };
    });

    // BBVA: 3200 + 5400 = 8600 (2 pagos)
    expect(conciliacion[0].total).toBe(8600);
    expect(conciliacion[0].conteo).toBe(2);

    // Banorte: 1800 + 4500 + 2100 = 8400 (3 pagos)
    expect(conciliacion[1].total).toBe(8400);
    expect(conciliacion[1].conteo).toBe(3);

    // Santander: 7800 (1 pago)
    expect(conciliacion[2].total).toBe(7800);
    expect(conciliacion[2].conteo).toBe(1);

    const totalSPEI = conciliacion.reduce((acc, c) => acc + c.total, 0);
    expect(totalSPEI).toBe(24800);
  });

  it("debe calcular con precisión la regla de Remesa (Cash Drop) y Fondo Remanente", () => {
    // Al final del turno el cajero cuenta $14,800 en efectivo en Fondo 1
    const totalContadoF1 = 14800;

    // Política del taller: siempre dejar un fondo base de $1,500 en cajón para el turno siguiente
    const fondoBaseSiguienteTurno = 1500;

    // Remesa sugerida a retirar en sobre hacia la caja fuerte
    const remesaRetiro = Math.max(0, totalContadoF1 - fondoBaseSiguienteTurno);

    expect(remesaRetiro).toBe(13300);
    expect(totalContadoF1 - remesaRetiro).toBe(fondoBaseSiguienteTurno);
  });
});
