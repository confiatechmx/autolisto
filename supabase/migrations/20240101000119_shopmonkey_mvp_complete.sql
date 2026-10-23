-- 20240101000119_shopmonkey_mvp_complete.sql
-- Migración integral para MVP estilo Shopmonkey (White-Label, Multi-Sucursal, DVI, Buyouts, Trabajos Diferidos, Caja Chica y Portal Público)

-- 1. EXPANSIÓN WHITE-LABEL EN EMPRESAS
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS color_primario TEXT DEFAULT '#2563EB',
  ADD COLUMN IF NOT EXISTS color_sidebar TEXT DEFAULT '#0F172A',
  ADD COLUMN IF NOT EXISTS eslogan TEXT DEFAULT 'Centro Automotriz y Llantera Especializada',
  ADD COLUMN IF NOT EXISTS telefono TEXT DEFAULT '81 2345 6789',
  ADD COLUMN IF NOT EXISTS email_contacto TEXT DEFAULT 'contacto@autolisto.mx',
  ADD COLUMN IF NOT EXISTS sitio_web TEXT DEFAULT 'www.autolisto.mx',
  ADD COLUMN IF NOT EXISTS margen_refacciones_default NUMERIC DEFAULT 35.00,
  ADD COLUMN IF NOT EXISTS terminos_condiciones TEXT DEFAULT 'Garantía de 30 días o 1,000 km en mano de obra. Refacciones y neumáticos sujetos a garantía del fabricante.';

-- 2. TABLA DE SUCURSALES (MULTI-BRANCH)
CREATE TABLE IF NOT EXISTS public.sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT public.user_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  codigo TEXT DEFAULT 'MTY-01',
  direccion TEXT,
  telefono TEXT,
  gerente TEXT,
  es_matriz BOOLEAN DEFAULT false,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento SaaS sucursales" ON public.sucursales;
CREATE POLICY "Aislamiento SaaS sucursales" ON public.sucursales
  FOR ALL TO authenticated
  USING (empresa_id = public.user_empresa_id())
  WITH CHECK (empresa_id = public.user_empresa_id());

-- 3. ACTUALIZAR PERFILES CON SUCURSAL ACTIVA
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 4. ACTUALIZAR EMPLEADOS (TÉCNICOS Y ASESORES CON COMISIONES)
ALTER TABLE public.empleados DROP CONSTRAINT IF EXISTS empleados_rol_check;
ALTER TABLE public.empleados ADD CONSTRAINT empleados_rol_check
  CHECK (rol = ANY (ARRAY['Administrador'::text, 'Asesor'::text, 'Vendedor'::text, 'Mecánico'::text, 'Recepcionista'::text]));

ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS especialidad TEXT DEFAULT 'Mecánica General',
  ADD COLUMN IF NOT EXISTS comision_porcentaje NUMERIC DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS tarifa_hora NUMERIC DEFAULT 350.00,
  ADD COLUMN IF NOT EXISTS color_avatar TEXT DEFAULT '#2563EB',
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL;

-- 5. ACTUALIZAR SERVICIOS_TALLER CON CATEGORÍA Y TIEMPO ESTIMADO
ALTER TABLE public.servicios_taller
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Mantenimiento',
  ADD COLUMN IF NOT EXISTS horas_estimadas NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS codigo_sku TEXT;

-- 6. ACTUALIZAR INVENTARIO_LLANTAS_BASE Y VISTA
ALTER TABLE public.inventario_llantas_base
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ubicacion_rack TEXT DEFAULT 'Rack A-1',
  ADD COLUMN IF NOT EXISTS dot_anio TEXT DEFAULT '2425';

DROP VIEW IF EXISTS public.inventario_llantas;
CREATE VIEW public.inventario_llantas WITH (security_invoker = true) AS
SELECT
  id, marca, modelo_llanta, ancho, perfil, rin, indice_carga_velocidad,
  tipo_terreno, stock_actual, stock_minimo, precio_venta, costo_adquisicion,
  empresa_id, sucursal_id, ubicacion_rack, dot_anio
FROM public.inventario_llantas_base;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventario_llantas TO authenticated, anon;

-- 7. EXPANDIR ORDENES_SERVICIO (ESTILO SHOPMONKEY)
ALTER TABLE public.ordenes_servicio DROP CONSTRAINT IF EXISTS ordenes_servicio_estado_check;
ALTER TABLE public.ordenes_servicio ADD CONSTRAINT ordenes_servicio_estado_check
  CHECK (estado = ANY (ARRAY[
    'Citas del Día'::text,
    'En Inspección'::text,
    'Esperando Aprobación'::text,
    'En Rampa'::text,
    'Listo para Entrega'::text,
    'Entregado'::text,
    'Cancelado'::text
  ]));

ALTER TABLE public.ordenes_servicio
  ADD COLUMN IF NOT EXISTS folio SERIAL,
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asesor_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS problema_reportado TEXT,
  ADD COLUMN IF NOT EXISTS diagnostico_tecnico TEXT,
  ADD COLUMN IF NOT EXISTS bahia_rampa TEXT DEFAULT 'Por Asignar',
  ADD COLUMN IF NOT EXISTS fecha_promesa TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS checklist_recepcion JSONB DEFAULT '{"llanta_refaccion": true, "gato_herramienta": true, "tarjeta_circulacion": true, "objetos_valor": false, "birlo_seguridad": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS aprobado_cliente_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aprobado_cliente_nombre TEXT;

-- 8. EXPANDIR PARTIDAS DE MANO DE OBRA Y LLANTAS
ALTER TABLE public.orden_servicio_servicios
  ADD COLUMN IF NOT EXISTS cantidad NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS horas_labor NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS mecanico_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comision_porcentaje NUMERIC DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS estatus_aprobacion TEXT DEFAULT 'Aprobado' CHECK (estatus_aprobacion IN ('Pendiente', 'Aprobado', 'Rechazado', 'Diferido')),
  ADD COLUMN IF NOT EXISTS notas TEXT;

ALTER TABLE public.detalles_cotizacion
  ADD COLUMN IF NOT EXISTS estatus_aprobacion TEXT DEFAULT 'Aprobado' CHECK (estatus_aprobacion IN ('Pendiente', 'Aprobado', 'Rechazado', 'Diferido'));

-- 9. NUEVA TABLA: REFACCIONES SOBRE PEDIDO / BUYOUTS (CON CALCULADORA DE MARGEN)
CREATE TABLE IF NOT EXISTS public.orden_servicio_refacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_servicio_id UUID NOT NULL REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL DEFAULT public.user_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  numero_parte TEXT,
  proveedor TEXT DEFAULT 'AutoZone Comercial',
  cantidad NUMERIC NOT NULL DEFAULT 1,
  costo_unitario NUMERIC NOT NULL DEFAULT 0.00,
  margen_porcentaje NUMERIC NOT NULL DEFAULT 35.00,
  precio_unitario NUMERIC NOT NULL DEFAULT 0.00,
  subtotal NUMERIC NOT NULL DEFAULT 0.00,
  estatus_aprobacion TEXT DEFAULT 'Aprobado' CHECK (estatus_aprobacion IN ('Pendiente', 'Aprobado', 'Rechazado', 'Diferido')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.orden_servicio_refacciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento SaaS orden_servicio_refacciones" ON public.orden_servicio_refacciones;
CREATE POLICY "Aislamiento SaaS orden_servicio_refacciones" ON public.orden_servicio_refacciones
  FOR ALL TO authenticated
  USING (empresa_id = public.user_empresa_id())
  WITH CHECK (empresa_id = public.user_empresa_id());

-- 10. NUEVA TABLA: INSPECCIÓN DIGITAL DEL VEHÍCULO (DVI)
CREATE TABLE IF NOT EXISTS public.inspecciones_dvi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_servicio_id UUID NOT NULL REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL DEFAULT public.user_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  punto_inspeccion TEXT NOT NULL,
  severidad TEXT NOT NULL DEFAULT 'verde' CHECK (severidad IN ('verde', 'amarillo', 'rojo')),
  observaciones TEXT,
  recomendacion TEXT,
  costo_estimado NUMERIC DEFAULT 0.00,
  foto_url TEXT,
  estatus_cliente TEXT DEFAULT 'Pendiente' CHECK (estatus_cliente IN ('Pendiente', 'Aprobado', 'Diferido')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inspecciones_dvi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento SaaS inspecciones_dvi" ON public.inspecciones_dvi;
CREATE POLICY "Aislamiento SaaS inspecciones_dvi" ON public.inspecciones_dvi
  FOR ALL TO authenticated
  USING (empresa_id = public.user_empresa_id())
  WITH CHECK (empresa_id = public.user_empresa_id());

-- 11. NUEVA TABLA: TRABAJOS DIFERIDOS (DEFERRED WORK / PRÓXIMA VISITA)
CREATE TABLE IF NOT EXISTS public.trabajos_diferidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id UUID NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  orden_origen_id UUID REFERENCES public.ordenes_servicio(id) ON DELETE SET NULL,
  empresa_id UUID NOT NULL DEFAULT public.user_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  categoria TEXT DEFAULT 'Frenos y Suspensión',
  severidad TEXT DEFAULT 'amarillo' CHECK (severidad IN ('amarillo', 'rojo')),
  costo_estimado NUMERIC DEFAULT 0.00,
  notas TEXT,
  fecha_recordatorio DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  resuelto BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.trabajos_diferidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento SaaS trabajos_diferidos" ON public.trabajos_diferidos;
CREATE POLICY "Aislamiento SaaS trabajos_diferidos" ON public.trabajos_diferidos
  FOR ALL TO authenticated
  USING (empresa_id = public.user_empresa_id())
  WITH CHECK (empresa_id = public.user_empresa_id());

-- 12. CAJA CHICA Y PAGOS (MÉTODOS DE PAGO MEXICANOS)
ALTER TABLE public.pagos_orden DROP CONSTRAINT IF EXISTS pagos_orden_proveedor_pago_check;
ALTER TABLE public.pagos_orden ADD CONSTRAINT pagos_orden_proveedor_pago_check
  CHECK (proveedor_pago = ANY (ARRAY[
    'Efectivo'::text,
    'Transferencia SPEI'::text,
    'Terminal TPV'::text,
    'Tarjeta Débito'::text,
    'Tarjeta Crédito'::text,
    'Mercado Pago'::text,
    'Stripe'::text,
    'KueskiPay'::text,
    'Atrato'::text,
    'Transferencia'::text
  ]));

ALTER TABLE public.pagos_orden
  ADD COLUMN IF NOT EXISTS referencia TEXT,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT,
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL;

-- Quitar unique global en configuracion_pagos.proveedor para permitir multi-tenant limpio
ALTER TABLE public.configuracion_pagos DROP CONSTRAINT IF EXISTS configuracion_pagos_proveedor_key;

CREATE TABLE IF NOT EXISTS public.caja_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT public.user_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Fondo Inicial', 'Ingreso Extra', 'Gasto / Insumos', 'Pago Proveedor')),
  concepto TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  metodo TEXT DEFAULT 'Efectivo',
  responsable TEXT DEFAULT 'Caja General',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.caja_movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento SaaS caja_movimientos" ON public.caja_movimientos;
CREATE POLICY "Aislamiento SaaS caja_movimientos" ON public.caja_movimientos
  FOR ALL TO authenticated
  USING (empresa_id = public.user_empresa_id())
  WITH CHECK (empresa_id = public.user_empresa_id());

-- 13. FUNCIONES RPC SECURITY DEFINER PARA EL PORTAL PÚBLICO DEL CLIENTE (/orden/[id])
CREATE OR REPLACE FUNCTION public.obtener_orden_portal_publico(p_orden_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'orden', to_jsonb(o.*),
    'empresa', to_jsonb(emp.*),
    'sucursal', to_jsonb(suc.*),
    'vehiculo', to_jsonb(v.*),
    'cliente', to_jsonb(c.*),
    'mecanico', to_jsonb(mec.*),
    'asesor', to_jsonb(ase.*),
    'servicios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oss.id,
        'precio_cobrado', oss.precio_cobrado,
        'cantidad', oss.cantidad,
        'horas_labor', oss.horas_labor,
        'estatus_aprobacion', oss.estatus_aprobacion,
        'notas', oss.notas,
        'servicio', to_jsonb(st.*)
      ))
      FROM public.orden_servicio_servicios oss
      LEFT JOIN public.servicios_taller st ON st.id = oss.servicio_id
      WHERE oss.orden_servicio_id = o.id
    ), '[]'::jsonb),
    'refacciones', COALESCE((
      SELECT jsonb_agg(to_jsonb(osr.*))
      FROM public.orden_servicio_refacciones osr
      WHERE osr.orden_servicio_id = o.id
    ), '[]'::jsonb),
    'llantas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', dc.id,
        'cantidad', dc.cantidad,
        'precio_unitario', dc.precio_unitario,
        'subtotal', dc.subtotal,
        'estatus_aprobacion', dc.estatus_aprobacion,
        'llanta', to_jsonb(il.*)
      ))
      FROM public.cotizaciones cot
      JOIN public.detalles_cotizacion dc ON dc.cotizacion_id = cot.id
      LEFT JOIN public.inventario_llantas_base il ON il.id = dc.llanta_id
      WHERE cot.id = o.cotizacion_id
    ), '[]'::jsonb),
    'dvi', COALESCE((
      SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at ASC)
      FROM public.inspecciones_dvi d
      WHERE d.orden_servicio_id = o.id
    ), '[]'::jsonb),
    'pagos', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*))
      FROM public.pagos_orden p
      WHERE p.orden_servicio_id = o.id AND p.deleted_at IS NULL
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.ordenes_servicio o
  LEFT JOIN public.empresas emp ON emp.id = o.empresa_id
  LEFT JOIN public.sucursales suc ON suc.id = o.sucursal_id
  LEFT JOIN public.vehiculos v ON v.id = o.vehiculo_id
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  LEFT JOIN public.empleados mec ON mec.id = o.mecanico_id
  LEFT JOIN public.empleados ase ON ase.id = o.asesor_id
  WHERE o.id = p_orden_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.obtener_orden_portal_publico(UUID) TO anon, authenticated;

-- RPC para que el cliente apruebe o difiera partidas desde su celular en /orden/[id]
CREATE OR REPLACE FUNCTION public.procesar_aprobacion_portal_cliente(
  p_orden_id UUID,
  p_servicios_diferidos UUID[],
  p_refacciones_diferidas UUID[],
  p_llantas_diferidas UUID[],
  p_nombre_firma TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_orden RECORD;
  v_vehiculo RECORD;
  r_srv RECORD;
  r_ref RECORD;
BEGIN
  SELECT * INTO v_orden FROM public.ordenes_servicio WHERE id = p_orden_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  SELECT * INTO v_vehiculo FROM public.vehiculos WHERE id = v_orden.vehiculo_id;

  -- 1. Marcar todos los servicios como Aprobado salvo los diferidos
  UPDATE public.orden_servicio_servicios
  SET estatus_aprobacion = CASE
    WHEN id = ANY(COALESCE(p_servicios_diferidos, ARRAY[]::UUID[])) THEN 'Diferido'
    ELSE 'Aprobado'
  END
  WHERE orden_servicio_id = p_orden_id;

  -- Crear registros en trabajos_diferidos para servicios diferidos
  FOR r_srv IN (
    SELECT oss.precio_cobrado, st.nombre, st.categoria
    FROM public.orden_servicio_servicios oss
    JOIN public.servicios_taller st ON st.id = oss.servicio_id
    WHERE oss.orden_servicio_id = p_orden_id
      AND oss.id = ANY(COALESCE(p_servicios_diferidos, ARRAY[]::UUID[]))
  ) LOOP
    INSERT INTO public.trabajos_diferidos (
      vehiculo_id, cliente_id, orden_origen_id, empresa_id, concepto, categoria, severidad, costo_estimado, notas
    ) VALUES (
      v_orden.vehiculo_id, v_vehiculo.cliente_id, p_orden_id, v_orden.empresa_id,
      r_srv.nombre, COALESCE(r_srv.categoria, 'Mantenimiento'), 'amarillo', r_srv.precio_cobrado,
      'Diferido por el cliente desde el Portal Digital'
    );
  END LOOP;

  -- 2. Marcar todas las refacciones como Aprobado salvo las diferidas
  UPDATE public.orden_servicio_refacciones
  SET estatus_aprobacion = CASE
    WHEN id = ANY(COALESCE(p_refacciones_diferidas, ARRAY[]::UUID[])) THEN 'Diferido'
    ELSE 'Aprobado'
  END
  WHERE orden_servicio_id = p_orden_id;

  FOR r_ref IN (
    SELECT nombre, subtotal
    FROM public.orden_servicio_refacciones
    WHERE orden_servicio_id = p_orden_id
      AND id = ANY(COALESCE(p_refacciones_diferidas, ARRAY[]::UUID[]))
  ) LOOP
    INSERT INTO public.trabajos_diferidos (
      vehiculo_id, cliente_id, orden_origen_id, empresa_id, concepto, categoria, severidad, costo_estimado, notas
    ) VALUES (
      v_orden.vehiculo_id, v_vehiculo.cliente_id, p_orden_id, v_orden.empresa_id,
      'Refacción: ' || r_ref.nombre, 'Refacciones', 'amarillo', r_ref.subtotal,
      'Diferido por el cliente desde el Portal Digital'
    );
  END LOOP;

  -- 3. Marcar llantas
  IF v_orden.cotizacion_id IS NOT NULL THEN
    UPDATE public.detalles_cotizacion
    SET estatus_aprobacion = CASE
      WHEN id = ANY(COALESCE(p_llantas_diferidas, ARRAY[]::UUID[])) THEN 'Diferido'
      ELSE 'Aprobado'
    END
    WHERE cotizacion_id = v_orden.cotizacion_id;
  END IF;

  -- 4. Actualizar estado de la orden y firma
  UPDATE public.ordenes_servicio
  SET
    aprobado_cliente_at = timezone('utc'::text, now()),
    aprobado_cliente_nombre = COALESCE(NULLIF(TRIM(p_nombre_firma), ''), 'Cliente'),
    estado = CASE WHEN estado IN ('Citas del Día', 'En Inspección', 'Esperando Aprobación') THEN 'En Rampa' ELSE estado END
  WHERE id = p_orden_id;

  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.procesar_aprobacion_portal_cliente(UUID, UUID[], UUID[], UUID[], TEXT) TO anon, authenticated;
