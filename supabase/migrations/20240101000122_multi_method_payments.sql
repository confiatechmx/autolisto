-- ==============================================================================
-- AUTOLISTO SHOP OS - MIGRACIÓN PAGOS MULTI-MÉTODO (SPLIT PAYMENTS)
-- PROCESAMIENTO DE TRANSACCIONES Y COBROS CON MÚLTIPLES MÉTODOS DE PAGO
-- ==============================================================================

-- 1. HABILITAR PAGOS DE COTIZACIONES / VENTAS MOSTRADOR EN PAGOS_ORDEN
ALTER TABLE public.pagos_orden 
  ALTER COLUMN orden_servicio_id DROP NOT NULL;

ALTER TABLE public.pagos_orden 
  ADD COLUMN IF NOT EXISTS cotizacion_id UUID REFERENCES public.cotizaciones(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pagos_orden_cotizacion_id ON public.pagos_orden(cotizacion_id);

-- Restricción para garantizar que el pago apunte al menos a una orden o a una cotización
ALTER TABLE public.pagos_orden DROP CONSTRAINT IF EXISTS pagos_orden_target_check;
ALTER TABLE public.pagos_orden 
  ADD CONSTRAINT pagos_orden_target_check 
  CHECK (orden_servicio_id IS NOT NULL OR cotizacion_id IS NOT NULL);

-- Ampliar los métodos de pago permitidos en el check constraint
ALTER TABLE public.pagos_orden DROP CONSTRAINT IF EXISTS pagos_orden_proveedor_pago_check;
ALTER TABLE public.pagos_orden 
  ADD CONSTRAINT pagos_orden_proveedor_pago_check 
  CHECK (proveedor_pago IN ('Efectivo', 'Tarjeta', 'Terminal', 'Mercado Pago', 'Stripe', 'KueskiPay', 'Atrato', 'Transferencia'));


-- 2. AMPLIAR TABLA COTIZACIONES CON METODOS DE PAGO Y SUCURSAL
ALTER TABLE public.cotizaciones 
  ADD COLUMN IF NOT EXISTS metodos_pago JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL;


-- 3. PROCEDIMIENTO ATÓMICO: REGISTRO DE VENTA FORMAL CON PAGOS MULTI-MÉTODO
CREATE OR REPLACE FUNCTION public.fn_registrar_venta_multi_pago(
  p_cliente_id UUID,
  p_vehiculo_id UUID,
  p_vendedor_id UUID,
  p_items JSONB,
  p_pagos JSONB,
  p_sucursal_id UUID DEFAULT NULL,
  p_servicios_adicionales JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_cotizacion_id UUID;
  v_total_items NUMERIC := 0;
  v_total_pagos NUMERIC := 0;
  v_item RECORD;
  v_pago RECORD;
  v_stock_res JSONB;
  v_prov TEXT;
  v_det TEXT;
  v_ref TEXT;
BEGIN
  v_empresa_id := public.user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Usuario no autenticado');
  END IF;

  -- Calcular total de items
  FOR v_item IN SELECT (elem->>'subtotal')::NUMERIC AS subtotal FROM jsonb_array_elements(p_items) AS elem LOOP
    v_total_items := v_total_items + v_item.subtotal;
  END LOOP;

  -- Calcular servicios adicionales
  IF p_servicios_adicionales IS NOT NULL AND jsonb_array_length(p_servicios_adicionales) > 0 THEN
    FOR v_item IN SELECT (elem->>'precio')::NUMERIC AS precio FROM jsonb_array_elements(p_servicios_adicionales) AS elem LOOP
      v_total_items := v_total_items + v_item.precio;
    END LOOP;
  END IF;

  -- Calcular total de pagos recibidos
  FOR v_pago IN SELECT (elem->>'monto')::NUMERIC AS monto FROM jsonb_array_elements(p_pagos) AS elem LOOP
    v_total_pagos := v_total_pagos + v_pago.monto;
  END LOOP;

  -- Validar que los pagos cubran el total de la venta (tolerancia $0.05 por redondeo de centavos)
  IF v_total_pagos < (v_total_items - 0.05) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNDERPAYMENT',
      'total_venta', v_total_items,
      'total_pagos', v_total_pagos,
      'message', 'Los métodos de pago ($' || v_total_pagos || ') no cubren el total de la venta ($' || v_total_items || ')'
    );
  END IF;

  -- 1. Descontar stock atómicamente con bloqueo pesimista en base de datos
  v_stock_res := public.fn_descontar_stock_orden(p_items);
  IF NOT (v_stock_res->>'success')::BOOLEAN THEN
    RETURN v_stock_res;
  END IF;

  -- 2. Insertar cotización/venta formal
  INSERT INTO public.cotizaciones (
    cliente_id,
    vehiculo_id,
    vendedor_id,
    empresa_id,
    sucursal_id,
    total,
    estatus,
    metodos_pago,
    fecha
  ) VALUES (
    p_cliente_id,
    p_vehiculo_id,
    p_vendedor_id,
    v_empresa_id,
    p_sucursal_id,
    v_total_items,
    'Pagada',
    p_pagos,
    NOW()
  ) RETURNING id INTO v_cotizacion_id;

  -- 3. Insertar detalles de la cotización
  FOR v_item IN
    SELECT
      (elem->>'llanta_id')::UUID AS llanta_id,
      (elem->>'cantidad')::INTEGER AS cantidad,
      (elem->>'precio_unitario')::NUMERIC AS precio_unitario,
      (elem->>'subtotal')::NUMERIC AS subtotal
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    INSERT INTO public.detalles_cotizacion (
      cotizacion_id,
      empresa_id,
      llanta_id,
      cantidad,
      precio_unitario,
      subtotal
    ) VALUES (
      v_cotizacion_id,
      v_empresa_id,
      v_item.llanta_id,
      v_item.cantidad,
      v_item.precio_unitario,
      v_item.subtotal
    );
  END LOOP;

  -- 4. Registrar cada método de pago individual en pagos_orden
  FOR v_pago IN
    SELECT
      elem->>'metodo' AS metodo,
      (elem->>'monto')::NUMERIC AS monto,
      elem->>'referencia' AS referencia,
      elem->>'detalle' AS detalle
    FROM jsonb_array_elements(p_pagos) AS elem
  LOOP
    v_prov := CASE
      WHEN v_pago.metodo IN ('Tarjeta', 'Terminal', 'Clip', 'Point') THEN 'Tarjeta'
      WHEN v_pago.metodo IN ('Transferencia', 'SPEI') THEN 'Transferencia'
      WHEN v_pago.metodo IN ('KueskiPay', 'Kueski') THEN 'KueskiPay'
      WHEN v_pago.metodo = 'Atrato' THEN 'Atrato'
      WHEN v_pago.metodo = 'Stripe' THEN 'Stripe'
      WHEN v_pago.metodo = 'Mercado Pago' THEN 'Mercado Pago'
      ELSE 'Efectivo'
    END;

    v_det := COALESCE(v_pago.detalle, v_pago.metodo || ' en Mostrador');
    v_ref := COALESCE(v_pago.referencia, 'POS-' || UPPER(SUBSTRING(v_cotizacion_id::text, 1, 8)));

    INSERT INTO public.pagos_orden (
      cotizacion_id,
      empresa_id,
      sucursal_id,
      monto_total,
      proveedor_pago,
      metodo_detalle,
      referencia,
      estatus,
      fecha_pago
    ) VALUES (
      v_cotizacion_id,
      v_empresa_id,
      p_sucursal_id,
      v_pago.monto,
      v_prov,
      v_det,
      v_ref,
      'Aprobado',
      NOW()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'cotizacion_id', v_cotizacion_id,
    'total', v_total_items,
    'pagos_registrados', jsonb_array_length(p_pagos)
  );
END;
$$;


-- 4. PROCEDIMIENTO ATÓMICO: REGISTRO DE PAGOS MULTI-MÉTODO PARA ÓRDENES DE SERVICIO
CREATE OR REPLACE FUNCTION public.fn_registrar_pagos_orden_multi(
  p_orden_id UUID,
  p_pagos JSONB,
  p_sucursal_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_pago RECORD;
  v_prov TEXT;
  v_det TEXT;
  v_ref TEXT;
  v_nuevo_pagado NUMERIC;
  v_nuevo_estatus TEXT;
  v_total_orden NUMERIC := 0;
  v_serv_total NUMERIC := 0;
  v_ref_total NUMERIC := 0;
  v_cot_total NUMERIC := 0;
  v_cot_id UUID;
BEGIN
  v_empresa_id := public.user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Usuario no autenticado');
  END IF;

  IF p_pagos IS NULL OR jsonb_array_length(p_pagos) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_PAYMENTS', 'message', 'Sin pagos para registrar');
  END IF;

  -- 1. Insertar cada pago en pagos_orden
  FOR v_pago IN
    SELECT
      elem->>'metodo' AS metodo,
      (elem->>'monto')::NUMERIC AS monto,
      elem->>'referencia' AS referencia,
      elem->>'detalle' AS detalle
    FROM jsonb_array_elements(p_pagos) AS elem
  LOOP
    v_prov := CASE
      WHEN v_pago.metodo IN ('Tarjeta', 'Terminal', 'Clip', 'Point') THEN 'Tarjeta'
      WHEN v_pago.metodo IN ('Transferencia', 'SPEI') THEN 'Transferencia'
      WHEN v_pago.metodo IN ('KueskiPay', 'Kueski') THEN 'KueskiPay'
      WHEN v_pago.metodo = 'Atrato' THEN 'Atrato'
      WHEN v_pago.metodo = 'Stripe' THEN 'Stripe'
      WHEN v_pago.metodo = 'Mercado Pago' THEN 'Mercado Pago'
      ELSE 'Efectivo'
    END;

    v_det := COALESCE(v_pago.detalle, v_pago.metodo || ' en Caja');
    v_ref := COALESCE(v_pago.referencia, 'ORD-' || UPPER(SUBSTRING(p_orden_id::text, 1, 8)));

    INSERT INTO public.pagos_orden (
      orden_servicio_id,
      empresa_id,
      sucursal_id,
      monto_total,
      proveedor_pago,
      metodo_detalle,
      referencia,
      estatus,
      fecha_pago
    ) VALUES (
      p_orden_id,
      v_empresa_id,
      p_sucursal_id,
      v_pago.monto,
      v_prov,
      v_det,
      v_ref,
      'Aprobado',
      NOW()
    );
  END LOOP;

  -- 2. Calcular total pagado activo
  SELECT COALESCE(SUM(monto_total), 0)
  INTO v_nuevo_pagado
  FROM public.pagos_orden
  WHERE orden_servicio_id = p_orden_id AND deleted_at IS NULL;

  -- 3. Calcular total de la orden
  SELECT COALESCE(SUM(precio_cobrado), 0) INTO v_serv_total
  FROM public.orden_servicio_servicios
  WHERE orden_servicio_id = p_orden_id AND (estatus_aprobacion IS NULL OR estatus_aprobacion <> 'Diferido');

  SELECT COALESCE(SUM(subtotal), 0) INTO v_ref_total
  FROM public.orden_servicio_refacciones
  WHERE orden_servicio_id = p_orden_id AND (estatus_aprobacion IS NULL OR estatus_aprobacion <> 'Diferido');

  SELECT cotizacion_id INTO v_cot_id FROM public.ordenes_servicio WHERE id = p_orden_id;
  IF v_cot_id IS NOT NULL THEN
    SELECT COALESCE(SUM(subtotal), 0) INTO v_cot_total
    FROM public.detalles_cotizacion
    WHERE cotizacion_id = v_cot_id AND (estatus_aprobacion IS NULL OR estatus_aprobacion <> 'Diferido');
  END IF;

  v_total_orden := v_serv_total + v_ref_total + v_cot_total;

  IF v_nuevo_pagado >= (v_total_orden - 0.5) THEN
    v_nuevo_estatus := 'Pagado';
  ELSIF v_nuevo_pagado > 0 THEN
    v_nuevo_estatus := 'Parcial';
  ELSE
    v_nuevo_estatus := 'Pendiente';
  END IF;

  UPDATE public.ordenes_servicio
  SET estatus_pago = v_nuevo_estatus
  WHERE id = p_orden_id;

  RETURN jsonb_build_object(
    'success', true,
    'orden_id', p_orden_id,
    'total_orden', v_total_orden,
    'nuevo_pagado', v_nuevo_pagado,
    'estatus_pago', v_nuevo_estatus,
    'pagos_registrados', jsonb_array_length(p_pagos)
  );
END;
$$;
