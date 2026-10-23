-- ==============================================================================
-- MIGRATION: 20240101000123_cash_closing_and_turnos_engine.sql
-- DESCRIPTION: Motor de Control de Turnos, Arqueo Ciego, Multi-Fondo y Multi-Cuenta Bancaria (SPEI)
-- ==============================================================================

-- 1. TABLA: caja_fondos (Fondos físicos: Mostrador Operativo vs Reserva/Caja Fuerte)
CREATE TABLE IF NOT EXISTS caja_fondos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'OPERATIVO' CHECK (tipo IN ('OPERATIVO', 'RESERVA')),
    saldo_actual NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    saldo_minimo_alerta NUMERIC(12,2) DEFAULT 500.00,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_caja_fondos_empresa_sucursal ON caja_fondos(empresa_id, sucursal_id);

-- 2. TABLA: cuentas_bancarias (Cuentas SPEI específicas por empresa/sucursal)
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    banco TEXT NOT NULL,
    alias TEXT NOT NULL,
    titular TEXT,
    clabe TEXT,
    numero_cuenta TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_cuentas_bancarias_empresa ON cuentas_bancarias(empresa_id);

-- 3. TABLA: caja_turnos (Ciclo de vida del turno: Apertura, Arqueo, Corte Z y Remesa)
CREATE TABLE IF NOT EXISTS caja_turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    usuario_apertura_id UUID REFERENCES perfiles(id),
    usuario_cierre_id UUID REFERENCES perfiles(id),
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    fecha_cierre TIMESTAMPTZ,
    estado TEXT NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO', 'AUDITADO')),
    monto_apertura_fondo1 NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    monto_apertura_fondo2 NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    monto_cierre_declarado_f1 NUMERIC(12,2) DEFAULT NULL,
    monto_cierre_declarado_f2 NUMERIC(12,2) DEFAULT NULL,
    monto_cierre_teorico_f1 NUMERIC(12,2) DEFAULT NULL,
    monto_cierre_teorico_f2 NUMERIC(12,2) DEFAULT NULL,
    diferencia_f1 NUMERIC(12,2) DEFAULT NULL,
    diferencia_f2 NUMERIC(12,2) DEFAULT NULL,
    justificacion_descuadre TEXT,
    monto_remesa_retirada NUMERIC(12,2) DEFAULT 0.00,
    monto_fondo_siguiente_f1 NUMERIC(12,2) DEFAULT 0.00,
    snapshot_resumen JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_caja_turnos_sucursal_estado ON caja_turnos(sucursal_id, estado);

-- 4. TABLA: caja_arqueos_denominaciones (Conteo ciego de billetes y monedas por fondo)
CREATE TABLE IF NOT EXISTS caja_arqueos_denominaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turno_id UUID NOT NULL REFERENCES caja_turnos(id) ON DELETE CASCADE,
    fondo_id UUID NOT NULL REFERENCES caja_fondos(id) ON DELETE CASCADE,
    b1000 INT NOT NULL DEFAULT 0,
    b500 INT NOT NULL DEFAULT 0,
    b200 INT NOT NULL DEFAULT 0,
    b100 INT NOT NULL DEFAULT 0,
    b50 INT NOT NULL DEFAULT 0,
    b20 INT NOT NULL DEFAULT 0,
    m20 INT NOT NULL DEFAULT 0,
    m10 INT NOT NULL DEFAULT 0,
    m5 INT NOT NULL DEFAULT 0,
    m2 INT NOT NULL DEFAULT 0,
    m1 INT NOT NULL DEFAULT 0,
    centavos NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_calculado NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_caja_arqueos_turno ON caja_arqueos_denominaciones(turno_id, fondo_id);

-- 5. TABLA: caja_traspasos_fondos (Trazabilidad de rescate/inyección entre Fondo 1 y Fondo 2)
CREATE TABLE IF NOT EXISTS caja_traspasos_fondos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    turno_id UUID REFERENCES caja_turnos(id) ON DELETE SET NULL,
    fondo_origen_id UUID NOT NULL REFERENCES caja_fondos(id),
    fondo_destino_id UUID NOT NULL REFERENCES caja_fondos(id),
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    concepto TEXT NOT NULL,
    usuario_id UUID REFERENCES perfiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_caja_traspasos_empresa ON caja_traspasos_fondos(empresa_id, sucursal_id);

-- 6. COLUMNAS DE TRAZABILIDAD EN TABLAS EXISTENTES
ALTER TABLE pagos_orden ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID REFERENCES cuentas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE pagos_orden ADD COLUMN IF NOT EXISTS caja_turno_id UUID REFERENCES caja_turnos(id) ON DELETE SET NULL;
ALTER TABLE pagos_orden ADD COLUMN IF NOT EXISTS caja_fondo_id UUID REFERENCES caja_fondos(id) ON DELETE SET NULL;

ALTER TABLE caja_movimientos ADD COLUMN IF NOT EXISTS caja_turno_id UUID REFERENCES caja_turnos(id) ON DELETE SET NULL;
ALTER TABLE caja_movimientos ADD COLUMN IF NOT EXISTS caja_fondo_id UUID REFERENCES caja_fondos(id) ON DELETE SET NULL;

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS caja_turno_id UUID REFERENCES caja_turnos(id) ON DELETE SET NULL;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID REFERENCES cuentas_bancarias(id) ON DELETE SET NULL;

-- 7. PROCEDIMIENTOS ALMACENADOS ATÓMICOS

-- A. Abrir Turno
CREATE OR REPLACE FUNCTION fn_abrir_turno_caja(
    p_empresa_id UUID,
    p_sucursal_id UUID,
    p_usuario_id UUID,
    p_monto_fondo1 NUMERIC,
    p_monto_fondo2 NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_turno_existente UUID;
    v_nuevo_turno_id UUID;
    v_fondo1_id UUID;
    v_fondo2_id UUID;
BEGIN
    -- Validar si ya hay un turno ABIERTO en esta sucursal
    SELECT id INTO v_turno_existente
    FROM caja_turnos
    WHERE sucursal_id = p_sucursal_id AND estado = 'ABIERTO'
    LIMIT 1;

    IF v_turno_existente IS NOT NULL THEN
        RAISE EXCEPTION 'Ya existe un turno abierto en esta sucursal (ID: %)', v_turno_existente;
    END IF;

    -- Obtener o crear fondos 1 y 2
    SELECT id INTO v_fondo1_id
    FROM caja_fondos
    WHERE sucursal_id = p_sucursal_id AND tipo = 'OPERATIVO' AND activo = true
    LIMIT 1;

    IF v_fondo1_id IS NULL THEN
        INSERT INTO caja_fondos (empresa_id, sucursal_id, nombre, tipo, saldo_actual)
        VALUES (p_empresa_id, p_sucursal_id, 'Fondo 1: Operativo Mostrador', 'OPERATIVO', p_monto_fondo1)
        RETURNING id INTO v_fondo1_id;
    ELSE
        UPDATE caja_fondos SET saldo_actual = p_monto_fondo1, updated_at = now() WHERE id = v_fondo1_id;
    END IF;

    SELECT id INTO v_fondo2_id
    FROM caja_fondos
    WHERE sucursal_id = p_sucursal_id AND tipo = 'RESERVA' AND activo = true
    LIMIT 1;

    IF v_fondo2_id IS NULL THEN
        INSERT INTO caja_fondos (empresa_id, sucursal_id, nombre, tipo, saldo_actual)
        VALUES (p_empresa_id, p_sucursal_id, 'Fondo 2: Reserva Taller', 'RESERVA', p_monto_fondo2)
        RETURNING id INTO v_fondo2_id;
    ELSE
        UPDATE caja_fondos SET saldo_actual = p_monto_fondo2, updated_at = now() WHERE id = v_fondo2_id;
    END IF;

    -- Crear el nuevo turno
    INSERT INTO caja_turnos (
        empresa_id,
        sucursal_id,
        usuario_apertura_id,
        fecha_apertura,
        estado,
        monto_apertura_fondo1,
        monto_apertura_fondo2
    ) VALUES (
        p_empresa_id,
        p_sucursal_id,
        p_usuario_id,
        now(),
        'ABIERTO',
        p_monto_fondo1,
        p_monto_fondo2
    ) RETURNING id INTO v_nuevo_turno_id;

    -- Registrar movimiento de apertura en caja_movimientos para auditoría
    INSERT INTO caja_movimientos (
        empresa_id,
        sucursal_id,
        tipo,
        concepto,
        monto,
        metodo,
        caja_turno_id,
        caja_fondo_id,
        idempotency_key
    ) VALUES (
        p_empresa_id,
        p_sucursal_id,
        'Fondo Inicial',
        'Apertura de turno - Fondo 1 Operativo',
        p_monto_fondo1,
        'Efectivo',
        v_nuevo_turno_id,
        v_fondo1_id,
        'apertura-turno-' || v_nuevo_turno_id || '-f1'
    );

    RETURN jsonb_build_object(
        'success', true,
        'turno_id', v_nuevo_turno_id,
        'fondo1_id', v_fondo1_id,
        'fondo2_id', v_fondo2_id,
        'monto_f1', p_monto_fondo1,
        'monto_f2', p_monto_fondo2
    );
END;
$$;

-- B. Traspaso entre Fondos
CREATE OR REPLACE FUNCTION fn_traspaso_entre_fondos(
    p_turno_id UUID,
    p_fondo_origen_id UUID,
    p_fondo_destino_id UUID,
    p_monto NUMERIC,
    p_concepto TEXT,
    p_usuario_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id UUID;
    v_sucursal_id UUID;
    v_saldo_origen NUMERIC;
    v_traspaso_id UUID;
BEGIN
    IF p_monto <= 0 THEN
        RAISE EXCEPTION 'El monto del traspaso debe ser mayor a 0';
    END IF;

    IF p_fondo_origen_id = p_fondo_destino_id THEN
        RAISE EXCEPTION 'El fondo de origen y destino no pueden ser el mismo';
    END IF;

    -- Bloquear fondos con FOR UPDATE
    SELECT empresa_id, sucursal_id, saldo_actual INTO v_empresa_id, v_sucursal_id, v_saldo_origen
    FROM caja_fondos
    WHERE id = p_fondo_origen_id
    FOR UPDATE;

    IF v_saldo_origen < p_monto THEN
        RAISE EXCEPTION 'Saldo insuficiente en el fondo origen (Disponible: %, Solicitado: %)', v_saldo_origen, p_monto;
    END IF;

    -- Descontar del origen
    UPDATE caja_fondos
    SET saldo_actual = saldo_actual - p_monto, updated_at = now()
    WHERE id = p_fondo_origen_id;

    -- Abonar al destino
    UPDATE caja_fondos
    SET saldo_actual = saldo_actual + p_monto, updated_at = now()
    WHERE id = p_fondo_destino_id;

    -- Registrar en caja_traspasos_fondos
    INSERT INTO caja_traspasos_fondos (
        empresa_id,
        sucursal_id,
        turno_id,
        fondo_origen_id,
        fondo_destino_id,
        monto,
        concepto,
        usuario_id
    ) VALUES (
        v_empresa_id,
        v_sucursal_id,
        p_turno_id,
        p_fondo_origen_id,
        p_fondo_destino_id,
        p_monto,
        p_concepto,
        p_usuario_id
    ) RETURNING id INTO v_traspaso_id;

    -- Registrar movimientos espejos para auditoría en caja_movimientos
    INSERT INTO caja_movimientos (
        empresa_id,
        sucursal_id,
        tipo,
        concepto,
        monto,
        metodo,
        caja_turno_id,
        caja_fondo_id,
        idempotency_key
    ) VALUES (
        v_empresa_id,
        v_sucursal_id,
        'Traspaso Salida',
        'Traspaso enviado: ' || p_concepto,
        p_monto,
        'Efectivo',
        p_turno_id,
        p_fondo_origen_id,
        'traspaso-out-' || v_traspaso_id
    ), (
        v_empresa_id,
        v_sucursal_id,
        'Traspaso Entrada',
        'Traspaso recibido: ' || p_concepto,
        p_monto,
        'Efectivo',
        p_turno_id,
        p_fondo_destino_id,
        'traspaso-in-' || v_traspaso_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'traspaso_id', v_traspaso_id,
        'monto', p_monto,
        'saldo_origen_restante', v_saldo_origen - p_monto
    );
END;
$$;

-- C. Cerrar Turno y Snapshot Inmutable
CREATE OR REPLACE FUNCTION fn_cerrar_turno_caja(
    p_turno_id UUID,
    p_usuario_cierre_id UUID,
    p_declarado_f1 NUMERIC,
    p_declarado_f2 NUMERIC,
    p_denominaciones_f1 JSONB,
    p_denominaciones_f2 JSONB,
    p_justificacion TEXT,
    p_monto_remesa NUMERIC,
    p_monto_fondo_siguiente NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_turno RECORD;
    v_fondo1_id UUID;
    v_fondo2_id UUID;
    v_entradas_pos_f1 NUMERIC := 0;
    v_entradas_pos_f2 NUMERIC := 0;
    v_salidas_f1 NUMERIC := 0;
    v_salidas_f2 NUMERIC := 0;
    v_traspasos_in_f1 NUMERIC := 0;
    v_traspasos_out_f1 NUMERIC := 0;
    v_traspasos_in_f2 NUMERIC := 0;
    v_traspasos_out_f2 NUMERIC := 0;
    v_teorico_f1 NUMERIC := 0;
    v_teorico_f2 NUMERIC := 0;
    v_diferencia_f1 NUMERIC := 0;
    v_diferencia_f2 NUMERIC := 0;
    v_snapshot JSONB;
BEGIN
    SELECT * INTO v_turno
    FROM caja_turnos
    WHERE id = p_turno_id
    FOR UPDATE;

    IF v_turno IS NULL THEN
        RAISE EXCEPTION 'El turno no existe';
    END IF;

    IF v_turno.estado != 'ABIERTO' THEN
        RAISE EXCEPTION 'El turno ya ha sido cerrado o auditado previamente';
    END IF;

    -- Obtener fondos
    SELECT id INTO v_fondo1_id FROM caja_fondos WHERE sucursal_id = v_turno.sucursal_id AND tipo = 'OPERATIVO' LIMIT 1;
    SELECT id INTO v_fondo2_id FROM caja_fondos WHERE sucursal_id = v_turno.sucursal_id AND tipo = 'RESERVA' LIMIT 1;

    -- Calcular cobros en efectivo asociados al turno (pagos_orden)
    SELECT COALESCE(SUM(monto_total), 0) INTO v_entradas_pos_f1
    FROM pagos_orden
    WHERE (caja_turno_id = p_turno_id OR (caja_turno_id IS NULL AND sucursal_id = v_turno.sucursal_id AND fecha_pago >= v_turno.fecha_apertura AND fecha_pago <= now()))
      AND proveedor_pago = 'Efectivo'
      AND (caja_fondo_id = v_fondo1_id OR caja_fondo_id IS NULL)
      AND estatus = 'COMPLETADO'
      AND deleted_at IS NULL;

    -- Salidas / Gastos en efectivo de Fondo 1
    SELECT COALESCE(SUM(monto), 0) INTO v_salidas_f1
    FROM caja_movimientos
    WHERE (caja_turno_id = p_turno_id OR (caja_turno_id IS NULL AND sucursal_id = v_turno.sucursal_id AND created_at >= v_turno.fecha_apertura AND created_at <= now()))
      AND tipo IN ('Gasto / Insumos', 'Pago Proveedor')
      AND (caja_fondo_id = v_fondo1_id OR caja_fondo_id IS NULL);

    -- Traspasos recibidos y enviados por Fondo 1
    SELECT COALESCE(SUM(monto), 0) INTO v_traspasos_in_f1
    FROM caja_traspasos_fondos WHERE turno_id = p_turno_id AND fondo_destino_id = v_fondo1_id;

    SELECT COALESCE(SUM(monto), 0) INTO v_traspasos_out_f1
    FROM caja_traspasos_fondos WHERE turno_id = p_turno_id AND fondo_origen_id = v_fondo1_id;

    -- Traspasos recibidos y enviados por Fondo 2
    SELECT COALESCE(SUM(monto), 0) INTO v_traspasos_in_f2
    FROM caja_traspasos_fondos WHERE turno_id = p_turno_id AND fondo_destino_id = v_fondo2_id;

    SELECT COALESCE(SUM(monto), 0) INTO v_traspasos_out_f2
    FROM caja_traspasos_fondos WHERE turno_id = p_turno_id AND fondo_origen_id = v_fondo2_id;

    -- Cálculos teóricos
    v_teorico_f1 := v_turno.monto_apertura_fondo1 + v_entradas_pos_f1 - v_salidas_f1 + v_traspasos_in_f1 - v_traspasos_out_f1;
    v_teorico_f2 := v_turno.monto_apertura_fondo2 + v_traspasos_in_f2 - v_traspasos_out_f2;

    v_diferencia_f1 := p_declarado_f1 - v_teorico_f1;
    v_diferencia_f2 := p_declarado_f2 - v_teorico_f2;

    -- Construir snapshot financiero inmutable
    v_snapshot := jsonb_build_object(
        'fecha_cierre', now(),
        'teorico_f1', v_teorico_f1,
        'declarado_f1', p_declarado_f1,
        'diferencia_f1', v_diferencia_f1,
        'teorico_f2', v_teorico_f2,
        'declarado_f2', p_declarado_f2,
        'diferencia_f2', v_diferencia_f2,
        'entradas_pos_f1', v_entradas_pos_f1,
        'salidas_f1', v_salidas_f1,
        'traspasos_in_f1', v_traspasos_in_f1,
        'traspasos_out_f1', v_traspasos_out_f1,
        'remesa_retirada', p_monto_remesa,
        'fondo_siguiente_f1', p_monto_fondo_siguiente,
        'denominaciones_f1', p_denominaciones_f1,
        'denominaciones_f2', p_denominaciones_f2
    );

    -- Actualizar caja_turnos
    UPDATE caja_turnos
    SET
        estado = 'CERRADO',
        usuario_cierre_id = p_usuario_cierre_id,
        fecha_cierre = now(),
        monto_cierre_declarado_f1 = p_declarado_f1,
        monto_cierre_declarado_f2 = p_declarado_f2,
        monto_cierre_teorico_f1 = v_teorico_f1,
        monto_cierre_teorico_f2 = v_teorico_f2,
        diferencia_f1 = v_diferencia_f1,
        diferencia_f2 = v_diferencia_f2,
        justificacion_descuadre = p_justificacion,
        monto_remesa_retirada = p_monto_remesa,
        monto_fondo_siguiente_f1 = p_monto_fondo_siguiente,
        snapshot_resumen = v_snapshot
    WHERE id = p_turno_id;

    -- Insertar desglose de denominaciones si se proveyeron
    IF p_denominaciones_f1 IS NOT NULL AND v_fondo1_id IS NOT NULL THEN
        INSERT INTO caja_arqueos_denominaciones (
            turno_id, fondo_id,
            b1000, b500, b200, b100, b50, b20,
            m20, m10, m5, m2, m1, centavos, total_calculado
        ) VALUES (
            p_turno_id, v_fondo1_id,
            COALESCE((p_denominaciones_f1->>'b1000')::int, 0),
            COALESCE((p_denominaciones_f1->>'b500')::int, 0),
            COALESCE((p_denominaciones_f1->>'b200')::int, 0),
            COALESCE((p_denominaciones_f1->>'b100')::int, 0),
            COALESCE((p_denominaciones_f1->>'b50')::int, 0),
            COALESCE((p_denominaciones_f1->>'b20')::int, 0),
            COALESCE((p_denominaciones_f1->>'m20')::int, 0),
            COALESCE((p_denominaciones_f1->>'m10')::int, 0),
            COALESCE((p_denominaciones_f1->>'m5')::int, 0),
            COALESCE((p_denominaciones_f1->>'m2')::int, 0),
            COALESCE((p_denominaciones_f1->>'m1')::int, 0),
            COALESCE((p_denominaciones_f1->>'centavos')::numeric, 0),
            p_declarado_f1
        );
    END IF;

    -- Actualizar saldos finales de los fondos
    IF v_fondo1_id IS NOT NULL THEN
        UPDATE caja_fondos SET saldo_actual = p_monto_fondo_siguiente, updated_at = now() WHERE id = v_fondo1_id;
    END IF;
    IF v_fondo2_id IS NOT NULL THEN
        UPDATE caja_fondos SET saldo_actual = p_declarado_f2, updated_at = now() WHERE id = v_fondo2_id;
    END IF;

    -- Asignar pagos y movimientos huérfanos del periodo a este turno
    UPDATE pagos_orden
    SET caja_turno_id = p_turno_id
    WHERE sucursal_id = v_turno.sucursal_id
      AND caja_turno_id IS NULL
      AND fecha_pago >= v_turno.fecha_apertura
      AND fecha_pago <= now();

    UPDATE caja_movimientos
    SET caja_turno_id = p_turno_id
    WHERE sucursal_id = v_turno.sucursal_id
      AND caja_turno_id IS NULL
      AND created_at >= v_turno.fecha_apertura
      AND created_at <= now();

    RETURN jsonb_build_object(
        'success', true,
        'turno_id', p_turno_id,
        'teorico_f1', v_teorico_f1,
        'declarado_f1', p_declarado_f1,
        'diferencia_f1', v_diferencia_f1,
        'teorico_f2', v_teorico_f2,
        'declarado_f2', p_declarado_f2,
        'diferencia_f2', v_diferencia_f2,
        'remesa_retirada', p_monto_remesa,
        'fondo_siguiente_f1', p_monto_fondo_siguiente
    );
END;
$$;

-- 8. RLS POLICIES
ALTER TABLE caja_fondos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_arqueos_denominaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_traspasos_fondos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "caja_fondos_empresa_isolation" ON caja_fondos;
    CREATE POLICY "caja_fondos_empresa_isolation" ON caja_fondos
        FOR ALL USING (
            empresa_id IN (
                SELECT empresa_id FROM perfiles WHERE id = auth.uid()
            ) OR auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NULL
        );

    DROP POLICY IF EXISTS "cuentas_bancarias_empresa_isolation" ON cuentas_bancarias;
    CREATE POLICY "cuentas_bancarias_empresa_isolation" ON cuentas_bancarias
        FOR ALL USING (
            empresa_id IN (
                SELECT empresa_id FROM perfiles WHERE id = auth.uid()
            ) OR auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NULL
        );

    DROP POLICY IF EXISTS "caja_turnos_empresa_isolation" ON caja_turnos;
    CREATE POLICY "caja_turnos_empresa_isolation" ON caja_turnos
        FOR ALL USING (
            empresa_id IN (
                SELECT empresa_id FROM perfiles WHERE id = auth.uid()
            ) OR auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NULL
        );

    DROP POLICY IF EXISTS "caja_arqueos_isolation" ON caja_arqueos_denominaciones;
    CREATE POLICY "caja_arqueos_isolation" ON caja_arqueos_denominaciones
        FOR ALL USING (true);

    DROP POLICY IF EXISTS "caja_traspasos_empresa_isolation" ON caja_traspasos_fondos;
    CREATE POLICY "caja_traspasos_empresa_isolation" ON caja_traspasos_fondos
        FOR ALL USING (
            empresa_id IN (
                SELECT empresa_id FROM perfiles WHERE id = auth.uid()
            ) OR auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NULL
        );
END $$;

-- 9. SEED DATA: Fondos y Cuentas Bancarias (Cova Tires Tenant Cero y Torque Matriz)
INSERT INTO sucursales (id, empresa_id, nombre, direccion, telefono, activa, es_matriz)
VALUES ('b2ad09db-0a34-4876-9ca3-d584c40bd295', 'b2ad09db-0a34-4876-9ca3-d584c40bd294', 'Matriz Cova Tires', 'Av. Gonzalitos 405, Monterrey, N.L.', '+528180001122', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO caja_fondos (id, empresa_id, sucursal_id, nombre, tipo, saldo_actual, saldo_minimo_alerta)
VALUES 
  ('c0000000-0000-0000-0000-000000000001', 'b2ad09db-0a34-4876-9ca3-d584c40bd294', 'b2ad09db-0a34-4876-9ca3-d584c40bd295', 'Fondo 1: Operativo Mostrador', 'OPERATIVO', 3000.00, 1000.00),
  ('c0000000-0000-0000-0000-000000000002', 'b2ad09db-0a34-4876-9ca3-d584c40bd294', 'b2ad09db-0a34-4876-9ca3-d584c40bd295', 'Fondo 2: Reserva Taller', 'RESERVA', 10000.00, 2000.00),
  ('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Fondo 1: Operativo Mostrador', 'OPERATIVO', 2500.00, 800.00),
  ('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Fondo 2: Reserva Taller', 'RESERVA', 8000.00, 1500.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cuentas_bancarias (id, empresa_id, sucursal_id, banco, alias, titular, clabe, numero_cuenta)
VALUES 
  ('c1000000-0000-0000-0000-000000000001', 'b2ad09db-0a34-4876-9ca3-d584c40bd294', 'b2ad09db-0a34-4876-9ca3-d584c40bd295', 'BBVA', 'BBVA Fiscal (Facturación)', 'Cova Tires S.A. de C.V.', '012580001394829102', '0139482910'),
  ('c1000000-0000-0000-0000-000000000002', 'b2ad09db-0a34-4876-9ca3-d584c40bd294', 'b2ad09db-0a34-4876-9ca3-d584c40bd295', 'Banorte', 'Banorte Operativa Taller', 'Cova Tires Servicios', '072580004819284719', '0481928471'),
  ('c1000000-0000-0000-0000-000000000003', 'b2ad09db-0a34-4876-9ca3-d584c40bd294', 'b2ad09db-0a34-4876-9ca3-d584c40bd295', 'Santander', 'Santander Reserva / Provisión', 'Cova Tires Administración', '014580009281746281', '0928174628'),
  ('c1000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'BBVA', 'BBVA Empresarial Matriz', 'Torque & Ruta S.A.S.', '012580004455667788', '0445566778'),
  ('c1000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Banregio', 'Banregio Operaciones', 'Torque & Ruta', '058580001122334455', '0112233445')
ON CONFLICT (id) DO NOTHING;
