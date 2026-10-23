'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';

export type PaymentProvider =
  | 'Efectivo'
  | 'Transferencia'
  | 'Mercado Pago'
  | 'Stripe'
  | 'KueskiPay'
  | 'Atrato';

export interface CuotaSimulation {
  plazo: string;
  monto_cuota: number;
  total_estimado: number;
  leyenda: string;
}

export interface PaymentIntentResponse {
  success: boolean;
  payment_url?: string;
  qr_data_url?: string;
  external_transaction_id?: string;
  simulacion_cuotas?: CuotaSimulation[];
  error?: string;
}

/**
 * Simula o genera las opciones de cuotas para BNPL (KueskiPay y Atrato Pago)
 */
export async function simularCuotasBNPL(
  monto: number,
  proveedor: 'KueskiPay' | 'Atrato'
): Promise<CuotaSimulation[]> {
  const montoNum = Math.max(0, Number(monto) || 0);

  if (proveedor === 'KueskiPay') {
    // Kueski Pay maneja quincenas (comúnmente 4, 8, 12 quincenas)
    return [
      {
        plazo: '4 Quincenas',
        monto_cuota: Math.round((montoNum * 1.05) / 4),
        total_estimado: Math.round(montoNum * 1.05),
        leyenda: 'Aprobación en 2 minutos sin tarjeta de crédito',
      },
      {
        plazo: '8 Quincenas',
        monto_cuota: Math.round((montoNum * 1.10) / 8),
        total_estimado: Math.round(montoNum * 1.10),
        leyenda: 'Ideal para mantenimientos mayores y frenos',
      },
      {
        plazo: '12 Quincenas',
        monto_cuota: Math.round((montoNum * 1.16) / 12),
        total_estimado: Math.round(montoNum * 1.16),
        leyenda: 'Pagos quincenales cómodos para juegos de llantas',
      },
    ];
  }

  // Atrato Pago maneja financiamiento automotriz y llantas de 6 a 24 meses
  return [
    {
      plazo: '6 Meses',
      monto_cuota: Math.round((montoNum * 1.08) / 6),
      total_estimado: Math.round(montoNum * 1.08),
      leyenda: 'Crédito especializado automotriz con tasa fija',
    },
    {
      plazo: '12 Meses',
      monto_cuota: Math.round((montoNum * 1.16) / 12),
      total_estimado: Math.round(montoNum * 1.16),
      leyenda: 'El plazo preferido en paquetes de 4 llantas y suspensión',
    },
    {
      plazo: '24 Meses',
      monto_cuota: Math.round((montoNum * 1.28) / 24),
      total_estimado: Math.round(montoNum * 1.28),
      leyenda: 'Máxima flexibilidad para reparaciones mayores de motor',
    },
  ];
}

/**
 * Genera un link de pago real o simulado con QR Code para el cliente en ventanilla o WhatsApp.
 */
export async function generatePaymentLink(
  ordenId: string,
  monto: number,
  proveedor: PaymentProvider,
  descripcion: string = 'Servicio Automotriz',
  sucursalId?: string,
  clienteTelefono?: string
): Promise<PaymentIntentResponse> {
  const supabase = await createClient();

  try {
    const timestamp = Date.now();
    let paymentUrl = '';
    let externalTransactionId = '';
    let cuotas: CuotaSimulation[] | undefined;

    if (proveedor === 'Mercado Pago') {
      // Mock / Sandbox URL de Mercado Pago
      externalTransactionId = `mp_pref_${timestamp}`;
      paymentUrl = `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${externalTransactionId}&order=${ordenId}&amount=${monto}`;
    } else if (proveedor === 'Stripe') {
      // Mock / Sandbox URL de Stripe Checkout
      externalTransactionId = `cs_stripe_${timestamp}`;
      paymentUrl = `https://checkout.stripe.com/pay/${externalTransactionId}#amount=${monto}`;
    } else if (proveedor === 'KueskiPay') {
      externalTransactionId = `kueski_${timestamp}`;
      paymentUrl = `https://pay.kueskipay.com/checkout/${externalTransactionId}?order=${ordenId}&amount=${monto}`;
      cuotas = await simularCuotasBNPL(monto, 'KueskiPay');
    } else if (proveedor === 'Atrato') {
      externalTransactionId = `atrato_${timestamp}`;
      paymentUrl = `https://checkout.atratopago.com/solicitud/${externalTransactionId}?order=${ordenId}&amount=${monto}`;
      cuotas = await simularCuotasBNPL(monto, 'Atrato');
    } else {
      // Efectivo o Transferencia: URL de comprobante
      externalTransactionId = `manual_${timestamp}`;
      paymentUrl = `https://autolisto.mx/recibo/${ordenId}?t=${timestamp}`;
    }

    // Generar código QR en base64 de alta resolución
    const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
      width: 340,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });

    // Guardar el intento de pago en `pagos_orden` como "Procesando" si es pasarela digital
    if (proveedor !== 'Efectivo' && proveedor !== 'Transferencia') {
      const { data: configRow } = await supabase
        .from('configuracion_pagos')
        .select('comision_porcentaje')
        .eq('proveedor', proveedor)
        .maybeSingle();

      const pctComision = Number(configRow?.comision_porcentaje || 3.5);
      const comisionMonto = Number(((monto * pctComision) / 100).toFixed(2));

      await supabase.from('pagos_orden').insert({
        orden_servicio_id: ordenId,
        sucursal_id: sucursalId || null,
        monto_total: monto,
        proveedor_pago: proveedor,
        metodo_detalle: `${proveedor} Link / QR`,
        referencia: externalTransactionId,
        estatus: 'Procesando',
        comision_pasarela: comisionMonto,
        fecha_pago: new Date().toISOString(),
      });
    }

    revalidatePath('/(dashboard)/tablero', 'page');
    revalidatePath('/(dashboard)/caja', 'page');
    revalidatePath(`/orden/${ordenId}`, 'page');

    return {
      success: true,
      payment_url: paymentUrl,
      qr_data_url: qrDataUrl,
      external_transaction_id: externalTransactionId,
      simulacion_cuotas: cuotas,
    };
  } catch (error: any) {
    console.error('Error generando link de pago:', error);
    return { success: false, error: error?.message || 'Error desconocido' };
  }
}
