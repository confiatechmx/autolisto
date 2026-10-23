-- ==============================================================================
-- AUTOLISTO SHOP OS - MIGRACIÓN MULTITENANT, MARCA BLANCA Y CONTROL HQ
-- TRASLADO E INTEGRACIÓN DE INFRAESTRUCTURA DE CONTROL PLANE & WHITE-LABEL
-- ==============================================================================

-- 1. EXPANSIÓN DE LA TABLA EMPRESAS (SaaS Tiers, Ambientes, Suscripción y Kill-Switch)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS plan_suscripcion VARCHAR(50) DEFAULT 'STARTER',
  ADD COLUMN IF NOT EXISTS ambiente VARCHAR(50) DEFAULT 'PRODUCTION',
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Asegurar restricciones de planes y ambientes
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_plan_check;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_plan_check
  CHECK (plan_suscripcion IN ('STARTER', 'PRO', 'ENTERPRISE', 'BASICO'));

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_ambiente_check;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_ambiente_check
  CHECK (ambiente IN ('PRODUCTION', 'SANDBOX', 'DEMO'));


-- 2. FUNCIÓN DE SEGURIDAD PARA DETECCIÓN DE SUPERADMIN
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND (rol = 'SuperAdmin' OR rol = 'SUPERADMIN')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- 3. TABLA DE DOMINIOS PERSONALIZADOS & MARCA BLANCA (PUBLIC.TENANT_DOMAINS)
CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT true,
  custom_theme JSONB DEFAULT '{"primary_color": "#2563EB", "sidebar_color": "#0F172A", "logo_url": null, "favicon_url": null, "app_title": "AutoListo"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain ON public.tenant_domains(LOWER(domain));
CREATE INDEX IF NOT EXISTS idx_tenant_domains_empresa_id ON public.tenant_domains(empresa_id);

ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

-- Lectura pública para resolución de branding antes de autenticación
DROP POLICY IF EXISTS "Permitir lectura publica de tenant_domains" ON public.tenant_domains;
CREATE POLICY "Permitir lectura publica de tenant_domains" ON public.tenant_domains
  FOR SELECT
  USING (true);

-- Gestión para Administradores de la Empresa y SuperAdmin
DROP POLICY IF EXISTS "Permitir gestion de tenant_domains" ON public.tenant_domains;
CREATE POLICY "Permitir gestion de tenant_domains" ON public.tenant_domains
  FOR ALL
  TO authenticated
  USING (
    empresa_id = public.user_empresa_id() 
    OR public.is_superadmin()
  )
  WITH CHECK (
    empresa_id = public.user_empresa_id() 
    OR public.is_superadmin()
  );


-- 4. TABLA DE BITÁCORA DE CONTROL PLANE / SUPERADMIN AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.superadmin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  accion VARCHAR(100) NOT NULL,
  detalles JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_logs_created_at ON public.superadmin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_logs_target ON public.superadmin_audit_logs(target_empresa_id);

ALTER TABLE public.superadmin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin audit logs select" ON public.superadmin_audit_logs;
CREATE POLICY "Superadmin audit logs select" ON public.superadmin_audit_logs
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin audit logs insert" ON public.superadmin_audit_logs;
CREATE POLICY "Superadmin audit logs insert" ON public.superadmin_audit_logs
  FOR INSERT WITH CHECK (public.is_superadmin());


-- 5. ACTUALIZACIÓN DE POLÍTICAS RLS EN EMPRESAS Y PERFILES PARA SUPERADMIN
DROP POLICY IF EXISTS "Usuarios pueden ver su empresa" ON public.empresas;
CREATE POLICY "Usuarios pueden ver su empresa" ON public.empresas
  FOR SELECT USING (
    id = public.user_empresa_id() 
    OR public.is_superadmin()
  );

DROP POLICY IF EXISTS "Usuarios pueden actualizar su empresa" ON public.empresas;
CREATE POLICY "Usuarios pueden actualizar su empresa" ON public.empresas
  FOR UPDATE USING (
    id = public.user_empresa_id() 
    OR public.is_superadmin()
  );

DROP POLICY IF EXISTS "Permitir creacion de empresas a superadmin" ON public.empresas;
CREATE POLICY "Permitir creacion de empresas a superadmin" ON public.empresas
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.perfiles;
CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.perfiles
  FOR SELECT USING (
    id = auth.uid() 
    OR empresa_id = public.user_empresa_id() 
    OR public.is_superadmin()
  );

DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.perfiles;
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.perfiles
  FOR UPDATE USING (
    id = auth.uid() 
    OR (empresa_id = public.user_empresa_id() AND EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'Administrador'))
    OR public.is_superadmin()
  );


-- 6. TRIGGER DE CUOTAS POR PLAN (SUCURSALES & TALLERES)
-- Starter: 1 sucursal (Matriz)
-- Pro: Hasta 3 sucursales
-- Enterprise: Ilimitado
CREATE OR REPLACE FUNCTION public.fn_verificar_cuota_sucursales()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan VARCHAR(50);
  v_conteo INT;
  v_limite INT;
BEGIN
  -- Si la sucursal no está activa, permitir sin límite
  IF NEW.activa IS FALSE THEN
    RETURN NEW;
  END IF;

  -- Si es UPDATE y no modifica estatus activo ni empresa_id, permitir
  IF TG_OP = 'UPDATE' THEN
    IF OLD.activa IS TRUE AND OLD.empresa_id = NEW.empresa_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Obtener plan de suscripción de la empresa
  SELECT UPPER(COALESCE(plan_suscripcion, 'STARTER'))
  INTO v_plan
  FROM public.empresas
  WHERE id = NEW.empresa_id;

  -- Si no existe o es ENTERPRISE, permitir sin límite
  IF v_plan = 'ENTERPRISE' OR v_plan IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determinar límites según plan
  IF v_plan IN ('STARTER', 'BASICO') THEN
    v_limite := 1;
  ELSIF v_plan = 'PRO' THEN
    v_limite := 3;
  ELSE
    v_limite := 1;
  END IF;

  -- Contar sucursales activas actuales
  SELECT COUNT(*)
  INTO v_conteo
  FROM public.sucursales
  WHERE empresa_id = NEW.empresa_id
    AND activa IS TRUE
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF (v_conteo + 1) > v_limite THEN
    RAISE EXCEPTION 'Límite de sucursales excedido para Plan % (máximo % sucursal/es activa/s). Tu empresa cuenta con % sucursal/es activa/s. Para añadir una nueva sucursal, inactiva una en desuso o actualiza a Plan Pro o Enterprise.',
      v_plan, v_limite, v_conteo
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verificar_cuota_sucursales ON public.sucursales;
CREATE TRIGGER trg_verificar_cuota_sucursales
  BEFORE INSERT OR UPDATE OF activa, empresa_id
  ON public.sucursales
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_verificar_cuota_sucursales();


-- 7. SEED INICIAL: REGISTRO DE DOMINIO DEMO & EMPRESA TORQUE & RUTA
DO $$
DECLARE
  v_empresa_id UUID;
BEGIN
  SELECT id INTO v_empresa_id FROM public.empresas LIMIT 1;
  IF v_empresa_id IS NOT NULL THEN
    -- Actualizar plan inicial de la empresa demo a Enterprise para desarrollo sin restricciones
    UPDATE public.empresas
    SET plan_suscripcion = 'ENTERPRISE',
        ambiente = 'PRODUCTION',
        activo = true,
        custom_metadata = jsonb_build_object(
          'suscripcion', jsonb_build_object(
            'plan', 'ENTERPRISE',
            'vigencia_hasta', (NOW() + interval '1 year')::text,
            'monto', 9999,
            'referencia', 'SEED-INITIAL-HQ'
          )
        )
    WHERE id = v_empresa_id;

    -- Registrar dominio por defecto en tenant_domains
    INSERT INTO public.tenant_domains (empresa_id, domain, is_primary, verified, custom_theme)
    VALUES (
      v_empresa_id,
      'torqueyruta.autolisto.mx',
      true,
      true,
      jsonb_build_object(
        'primary_color', '#2563EB',
        'sidebar_color', '#0F172A',
        'app_title', 'Torque & Ruta',
        'logo_url', null,
        'favicon_url', '/favicon.ico'
      )
    )
    ON CONFLICT (domain) DO UPDATE SET
      empresa_id = EXCLUDED.empresa_id,
      is_primary = EXCLUDED.is_primary,
      verified = EXCLUDED.verified,
      custom_theme = EXCLUDED.custom_theme,
      updated_at = NOW();
  END IF;
END $$;
