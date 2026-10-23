export interface CuotaSimulation {
  plazo: string;
  monto_cuota: number;
  total_estimado: number;
  leyenda: string;
}

export function calcularCuotasBNPL(
  monto: number,
  proveedor: 'KueskiPay' | 'Atrato'
): CuotaSimulation[] {
  const montoNum = Math.max(0, Number(monto) || 0);

  if (proveedor === 'KueskiPay') {
    return [
      {
        plazo: '4 Quincenas',
        monto_cuota: Math.round((montoNum * 1.05) / 4),
        total_estimado: Math.round(montoNum * 1.05),
        leyenda: 'Aprobación en 2 min sin tarjeta de crédito',
      },
      {
        plazo: '8 Quincenas',
        monto_cuota: Math.round((montoNum * 1.1) / 8),
        total_estimado: Math.round(montoNum * 1.1),
        leyenda: 'Ideal para mantenimientos mayores y frenos',
      },
      {
        plazo: '12 Quincenas',
        monto_cuota: Math.round((montoNum * 1.16) / 12),
        total_estimado: Math.round(montoNum * 1.16),
        leyenda: 'Pagos quincenales cómodos para llantas y refacciones',
      },
    ];
  } else {
    return [
      {
        plazo: '6 Meses',
        monto_cuota: Math.round((montoNum * 1.08) / 6),
        total_estimado: Math.round(montoNum * 1.08),
        leyenda: 'Financiamiento directo con INE y WhatsApp',
      },
      {
        plazo: '12 Meses',
        monto_cuota: Math.round((montoNum * 1.16) / 12),
        total_estimado: Math.round(montoNum * 1.16),
        leyenda: 'Ideal para reparaciones mayores de motor y transmisión',
      },
      {
        plazo: '18 Meses',
        monto_cuota: Math.round((montoNum * 1.24) / 18),
        total_estimado: Math.round(montoNum * 1.24),
        leyenda: 'Plazo extendido sin descapitalizarse',
      },
      {
        plazo: '24 Meses',
        monto_cuota: Math.round((montoNum * 1.32) / 24),
        total_estimado: Math.round(montoNum * 1.32),
        leyenda: 'Cuota mensual mínima para flotillas o clientes particulares',
      },
    ];
  }
}
