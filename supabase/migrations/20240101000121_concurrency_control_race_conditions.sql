-- ==============================================================================
-- AUTOLISTO SHOP OS - MIGRACIÓN CONTROL DE CONCURRENCIA (RACE CONDITIONS)
-- BLOQUEOS PESIMISTAS, CONCURRENCIA OPTIMISTA, IDEMPOTENCIA Y PROCEDIMIENTOS ATÓMICOS
-- ==============================================================================

-- 1. CONCURRENCIA OPTIMISTA EN ÓRDENES DE SERVICIO
ALTER TABLE public.ordenes_servicio
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Función y trigger de auto-incremento de versión
CREATE OR REPLACE FUNCTION public.fn_ordenes_servicio_version_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := timezone('utc'::text, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ordenes_servicio_version ON public.ordenes_servicio;
CREATE TRIGGER trg_ordenes_servicio_version
  BEFORE UPDATE ON public.ordenes_servicio
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ordenes_servicio_version_trigger();


-- 2. PROTECCIÓN CONTRA OPERACIONES DUPLICADAS EN CAJA CHICA (IDEMPOTENCIA)
ALTER TABLE public.caja_movimientos
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_caja_movimientos_idempotency 
  ON public.caja_movimientos(empresa_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;


-- 3. PROCEDIMIENTO ATÓMICO: AJUSTE DE STOCK DE NEUMÁTICOS CON BLOQUEO PESIMISTA
CREATE OR REPLACE FUNCTION public.fn_ajustar_stock_llanta(
  p_llanta_id UUID,
  p_cantidad_delta INTEGER,
  p_permitir_negativo BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_actual INTEGER;
  v_nuevo_stock INTEGER;
  v_marca TEXT;
  v_modelo TEXT;
  v_empresa_id UUID;
BEGIN
  -- Bloqueo pesimista de fila: evita que dos recepcionistas o cajeros vendan la misma pieza simultáneamente
  SELECT stock_actual, marca, modelo_llanta, empresa_id
  INTO v_stock_actual, v_marca, v_modelo, v_empresa_id
  FROM public.inventario_llantas_base
  WHERE id = p_llanta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ITEM_NOT_FOUND',
      'message', 'El neumático no existe en el inventario'
    );
  END IF;

  -- Validar aislamiento multi-tenant
  IF v_empresa_id <> public.user_empresa_id() AND NOT public.is_superadmin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'No tienes permisos para modificar el inventario de esta empresa'
    );
  END IF;

  v_nuevo_stock := v_stock_actual + p_cantidad_delta;

  IF v_nuevo_stock < 0 AND NOT p_permitir_negativo THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_STOCK',
      'stock_actual', v_stock_actual,
      'solicitado', ABS(p_cantidad_delta),
      'marca', v_marca,
      'modelo', v_modelo,
      'message', 'Stock insuficiente para ' || v_marca || ' ' || v_modelo || '. Existencia disponible: ' || v_stock_actual || ', solicitado: ' || ABS(p_cantidad_delta)
    );
  END IF;

  UPDATE public.inventario_llantas_base
  SET stock_actual = v_nuevo_stock
  WHERE id = p_llanta_id;

  RETURN jsonb_build_object(
    'success', true,
    'llanta_id', p_llanta_id,
    'stock_anterior', v_stock_actual,
    'nuevo_stock', v_nuevo_stock,
    'delta', p_cantidad_delta
  );
END;
$$;


-- 4. PROCEDIMIENTO ATÓMICO: DESCUENTO MASIVO DE STOCK PARA COTIZACIÓN U ORDEN
CREATE OR REPLACE FUNCTION public.fn_descontar_stock_orden(
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_llanta_id UUID;
  v_cantidad INTEGER;
  v_stock_actual INTEGER;
  v_marca TEXT;
  v_modelo TEXT;
  v_empresa_id UUID;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Sin items para procesar');
  END IF;

  -- 1. Validar disponibilidad y bloquear en orden ascendente de UUID para evitar deadlocks
  FOR v_item IN
    SELECT (elem->>'llanta_id')::UUID AS llanta_id, (elem->>'cantidad')::INTEGER AS cantidad
    FROM jsonb_array_elements(p_items) AS elem
    ORDER BY (elem->>'llanta_id')::UUID ASC
  LOOP
    v_llanta_id := v_item.llanta_id;
    v_cantidad := v_item.cantidad;

    SELECT stock_actual, marca, modelo_llanta, empresa_id
    INTO v_stock_actual, v_marca, v_modelo, v_empresa_id
    FROM public.inventario_llantas_base
    WHERE id = v_llanta_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'ITEM_NOT_FOUND',
        'llanta_id', v_llanta_id,
        'message', 'Neumático con ID ' || v_llanta_id || ' no encontrado'
      );
    END IF;

    IF v_empresa_id <> public.user_empresa_id() AND NOT public.is_superadmin() THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'UNAUTHORIZED',
        'message', 'Sin autorización multi-tenant para modificar inventario'
      );
    END IF;

    IF (v_stock_actual - v_cantidad) < 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_STOCK',
        'llanta_id', v_llanta_id,
        'stock_actual', v_stock_actual,
        'solicitado', v_cantidad,
        'message', 'Existencia insuficiente para ' || v_marca || ' ' || v_modelo || '. Stock: ' || v_stock_actual || ', solicitado: ' || v_cantidad
      );
    END IF;
  END LOOP;

  -- 2. Si todos tienen existencia suficiente, aplicar la deducción
  FOR v_item IN
    SELECT (elem->>'llanta_id')::UUID AS llanta_id, (elem->>'cantidad')::INTEGER AS cantidad
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    UPDATE public.inventario_llantas_base
    SET stock_actual = stock_actual - v_item.cantidad
    WHERE id = v_item.llanta_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_items', jsonb_array_length(p_items)
  );
END;
$$;


-- 5. PROCEDIMIENTO ATÓMICO: ACTUALIZACIÓN DE ORDEN CON DETECCIÓN DE CONFLICTOS OPTIMISTA
CREATE OR REPLACE FUNCTION public.fn_actualizar_orden_concurrente(
  p_orden_id UUID,
  p_expected_version INTEGER,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_version INTEGER;
  v_empresa_id UUID;
  v_orden RECORD;
BEGIN
  -- Bloquear fila para lectura segura de versión
  SELECT version, empresa_id INTO v_current_version, v_empresa_id
  FROM public.ordenes_servicio
  WHERE id = p_orden_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ORDER_NOT_FOUND',
      'message', 'La orden de servicio no fue encontrada'
    );
  END IF;

  IF v_empresa_id <> public.user_empresa_id() AND NOT public.is_superadmin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'No tienes permisos para modificar esta orden'
    );
  END IF;

  -- Detección de conflicto de concurrencia optimista
  IF p_expected_version IS NOT NULL AND v_current_version <> p_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'current_version', v_current_version,
      'expected_version', p_expected_version,
      'message', 'Conflicto de concurrencia: La orden fue modificada recientemente por otro usuario. Se recomienda recargar los datos más recientes.'
    );
  END IF;

  -- Actualizar campos permitidos dinámicamente si vienen en el payload
  UPDATE public.ordenes_servicio
  SET
    estado = COALESCE(p_payload->>'estado', estado),
    sub_estado = COALESCE(p_payload->>'sub_estado', sub_estado),
    prioridad = COALESCE(p_payload->>'prioridad', prioridad),
    estatus_pago = COALESCE(p_payload->>'estatus_pago', estatus_pago),
    mecanico_id = CASE WHEN p_payload ? 'mecanico_id' THEN (p_payload->>'mecanico_id')::UUID ELSE mecanico_id END,
    asesor_id = CASE WHEN p_payload ? 'asesor_id' THEN (p_payload->>'asesor_id')::UUID ELSE asesor_id END,
    bahia_rampa = COALESCE(p_payload->>'bahia_rampa', bahia_rampa),
    problema_reportado = COALESCE(p_payload->>'problema_reportado', problema_reportado),
    diagnostico_tecnico = COALESCE(p_payload->>'diagnostico_tecnico', diagnostico_tecnico),
    notas_recepcion = COALESCE(p_payload->>'notas_recepcion', notas_recepcion),
    fecha_promesa = CASE WHEN p_payload ? 'fecha_promesa' THEN (p_payload->>'fecha_promesa')::TIMESTAMPTZ ELSE fecha_promesa END
  WHERE id = p_orden_id
  RETURNING * INTO v_orden;

  RETURN jsonb_build_object(
    'success', true,
    'nuevo_version', v_orden.version,
    'orden', row_to_json(v_orden)
  );
END;
$$;


-- 6. REGISTRO ATÓMICO E IDEMPOTENTE DE MOVIMIENTOS EN CAJA CHICA
CREATE OR REPLACE FUNCTION public.fn_registrar_movimiento_caja(
  p_tipo TEXT,
  p_concepto TEXT,
  p_monto NUMERIC,
  p_metodo TEXT DEFAULT 'Efectivo',
  p_responsable TEXT DEFAULT 'Caja General',
  p_sucursal_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_mov_id UUID;
  v_existing RECORD;
BEGIN
  v_empresa_id := public.user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Usuario no autenticado o sin empresa asignada'
    );
  END IF;

  -- Validar idempotencia para prevenir duplicados por doble clic o reintentos
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, created_at, tipo, concepto, monto INTO v_existing
    FROM public.caja_movimientos
    WHERE empresa_id = v_empresa_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'id', v_existing.id,
        'message', 'Movimiento ya registrado previamente'
      );
    END IF;
  END IF;

  INSERT INTO public.caja_movimientos (
    empresa_id,
    sucursal_id,
    tipo,
    concepto,
    monto,
    metodo,
    responsable,
    idempotency_key
  ) VALUES (
    v_empresa_id,
    p_sucursal_id,
    p_tipo,
    p_concepto,
    p_monto,
    p_metodo,
    p_responsable,
    p_idempotency_key
  )
  RETURNING id INTO v_mov_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_mov_id,
    'idempotent_replay', false
  );
END;
$$;
