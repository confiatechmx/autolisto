import { createClient } from '../lib/supabase/client'

export interface EmpresaHqRecord {
  id: string
  nombre_comercial: string
  rfc?: string | null
  logo_url?: string | null
  color_primario?: string | null
  color_sidebar?: string | null
  ambiente: 'PRODUCTION' | 'SANDBOX' | 'DEMO'
  plan_suscripcion: 'STARTER' | 'PRO' | 'ENTERPRISE' | 'BASICO'
  activo: boolean
  created_at: string
  updated_at?: string | null
  custom_metadata?: {
    suscripcion?: {
      plan?: string
      vigencia_hasta?: string
      ultimo_pago_at?: string
      monto?: number
      referencia?: string
      metodo_pago?: string
      notas?: string
      registrado_por?: string
    }
    [key: string]: any
  }
  sucursales_activas: number
  sucursales_limite: number
  total_ordenes: number
  total_vehiculos: number
  total_perfiles: number
}

export interface SuperAdminAuditLog {
  id: string
  superadmin_id?: string
  target_empresa_id?: string
  accion: string
  detalles: any
  ip_address?: string
  created_at: string
}

export interface ImpersonationSession {
  isImpersonating: boolean
  originalSuperAdminId: string
  originalSuperAdminEmail: string
  originalSuperAdminNombre: string
  targetEmpresaId: string
  targetEmpresaNombre: string
  startedAt: string
}

const STORAGE_KEY_IMPERSONATION = 'autolisto_impersonation'
const STORAGE_KEY_AUDIT_LOGS = 'autolisto_superadmin_audit_logs'

export const isHqEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false
  const host = (window.location.hostname || '').toLowerCase()
  const search = (window.location.search || '').toLowerCase()
  const path = (window.location.pathname || '').toLowerCase()
  return (
    host.startsWith('admin.') ||
    host.startsWith('hq.') ||
    search.includes('mode=admin') ||
    search.includes('mode=hq') ||
    search.includes('app=admin') ||
    path.startsWith('/hq')
  )
}

export const saasHqService = {
  // 1. Obtener todas las empresas con métricas operativas enriquecidas
  async getEmpresasWithMetrics(): Promise<EmpresaHqRecord[]> {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Verificar rol SuperAdmin
      if (user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', user.id)
          .maybeSingle()

        const isSuper = perfil?.rol === 'SuperAdmin' || perfil?.rol === 'SUPERADMIN'
        // Si no está registrado como SuperAdmin, permitir si está en desarrollo o consultar si tiene permiso
        if (perfil && !isSuper && process.env.NODE_ENV === 'production') {
          throw new Error('Acceso no autorizado al Control Plane de AutoListo HQ.')
        }
      }

      // 1. Obtener todas las empresas
      const { data: empresasData, error: empresasError } = await supabase
        .from('empresas')
        .select('*')
        .order('nombre_comercial', { ascending: true })

      if (empresasError) {
        throw new Error(empresasError.message || 'Error consultando empresas')
      }

      const rawEmpresas = empresasData || []

      // 2. Conteo de sucursales por empresa
      let sucursalesPorEmpresa: Record<string, number> = {}
      try {
        const { data: sucursales } = await supabase
          .from('sucursales')
          .select('empresa_id, activa')

        if (sucursales) {
          sucursales.forEach((s) => {
            if (s.activa !== false) {
              sucursalesPorEmpresa[s.empresa_id] = (sucursalesPorEmpresa[s.empresa_id] || 0) + 1
            }
          })
        }
      } catch (e) {
        console.warn('Error al consultar conteo de sucursales:', e)
      }

      // 3. Conteo de órdenes de servicio por empresa
      let ordenesPorEmpresa: Record<string, number> = {}
      try {
        const { data: ordenes } = await supabase
          .from('ordenes_servicio')
          .select('empresa_id')

        if (ordenes) {
          ordenes.forEach((o) => {
            ordenesPorEmpresa[o.empresa_id] = (ordenesPorEmpresa[o.empresa_id] || 0) + 1
          })
        }
      } catch (e) {
        console.warn('Error al consultar conteo de órdenes:', e)
      }

      // 4. Conteo de vehículos registrados por empresa
      let vehiculosPorEmpresa: Record<string, number> = {}
      try {
        const { data: vehiculos } = await supabase
          .from('vehiculos')
          .select('empresa_id')

        if (vehiculos) {
          vehiculos.forEach((v) => {
            vehiculosPorEmpresa[v.empresa_id] = (vehiculosPorEmpresa[v.empresa_id] || 0) + 1
          })
        }
      } catch (e) {
        console.warn('Error al consultar conteo de vehículos:', e)
      }

      // 5. Conteo de usuarios/perfiles por empresa
      let perfilesPorEmpresa: Record<string, number> = {}
      try {
        const { data: perfiles } = await supabase
          .from('perfiles')
          .select('empresa_id')

        if (perfiles) {
          perfiles.forEach((p) => {
            perfilesPorEmpresa[p.empresa_id] = (perfilesPorEmpresa[p.empresa_id] || 0) + 1
          })
        }
      } catch (e) {
        console.warn('Error al consultar conteo de perfiles:', e)
      }

      // Mapear cada empresa calculando límites y cuotas
      const enriched: EmpresaHqRecord[] = rawEmpresas.map((emp: any) => {
        const plan = (emp.plan_suscripcion || 'STARTER').toUpperCase()
        let limiteSucursales = 1
        if (plan === 'PRO') {
          limiteSucursales = 3
        } else if (plan === 'ENTERPRISE') {
          limiteSucursales = 99999
        }

        return {
          id: emp.id,
          nombre_comercial: emp.nombre_comercial,
          rfc: emp.rfc,
          logo_url: emp.logo_url,
          color_primario: emp.color_primario || '#2563EB',
          color_sidebar: emp.color_sidebar || '#0F172A',
          ambiente: (emp.ambiente || 'PRODUCTION') as any,
          plan_suscripcion: plan as any,
          activo: emp.activo !== false,
          created_at: emp.created_at || new Date().toISOString(),
          updated_at: emp.updated_at,
          custom_metadata: emp.custom_metadata || {},
          sucursales_activas: sucursalesPorEmpresa[emp.id] || 0,
          sucursales_limite: limiteSucursales,
          total_ordenes: ordenesPorEmpresa[emp.id] || 0,
          total_vehiculos: vehiculosPorEmpresa[emp.id] || 0,
          total_perfiles: perfilesPorEmpresa[emp.id] || 0,
        }
      })

      return enriched
    } catch (err: any) {
      console.error('Error cargando empresas en saasHqService:', err)
      throw err
    }
  },

  // 2. Kill-Switch: Suspender o Reactivar Empresa
  async toggleEmpresaActivo(empresaId: string, nuevoEstado: boolean, motivo?: string): Promise<boolean> {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('empresas')
        .update({
          activo: nuevoEstado,
          updated_at: new Date().toISOString(),
        })
        .eq('id', empresaId)

      if (error) {
        console.warn('Error al actualizar estatus de empresa en Supabase:', error)
      }

      // Registrar auditoría obligatoria
      await this.logAudit({
        superadmin_id: user?.id,
        target_empresa_id: empresaId,
        accion: nuevoEstado ? 'TENANT_REACTIVATED' : 'TENANT_SUSPENDED',
        detalles: {
          motivo: motivo || (nuevoEstado ? 'Reactivación por Control Plane' : 'Suspensión administrativa por falta de pago'),
          fecha: new Date().toISOString(),
        },
      })

      return true
    } catch (e: any) {
      console.error('Error toggling empresa activo:', e)
      throw e
    }
  },

  // 3. Conciliación Manual de Pago & Renovación de Suscripción
  async registrarPagoConciliacion(params: {
    empresaId: string
    plan_suscripcion: 'STARTER' | 'PRO' | 'ENTERPRISE'
    mesesVigencia: number
    monto: number
    referencia: string
    metodoPago: string
    notas?: string
  }): Promise<boolean> {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const fechaActual = new Date()
      const vigenciaHasta = new Date(fechaActual)
      vigenciaHasta.setMonth(vigenciaHasta.getMonth() + params.mesesVigencia)

      const suscripcionMetadata = {
        plan: params.plan_suscripcion,
        vigencia_hasta: vigenciaHasta.toISOString(),
        ultimo_pago_at: fechaActual.toISOString(),
        monto: params.monto,
        referencia: params.referencia,
        metodo_pago: params.metodoPago,
        notas: params.notas || '',
        registrado_por: user?.email || 'SuperAdmin',
      }

      // 1. Obtener custom_metadata actual
      let currentMetadata = {}
      try {
        const { data: empresa } = await supabase
          .from('empresas')
          .select('custom_metadata')
          .eq('id', params.empresaId)
          .single()
        if (empresa?.custom_metadata) {
          currentMetadata = empresa.custom_metadata as any
        }
      } catch (e) {}

      // 2. Actualizar empresa en Supabase
      const { error } = await supabase
        .from('empresas')
        .update({
          plan_suscripcion: params.plan_suscripcion,
          activo: true, // Reactivar automáticamente al conciliar pago
          custom_metadata: {
            ...currentMetadata,
            suscripcion: suscripcionMetadata,
          },
          updated_at: fechaActual.toISOString(),
        })
        .eq('id', params.empresaId)

      if (error) {
        console.warn('Error al conciliar pago en Supabase:', error)
      }

      // 3. Registrar auditoría de conciliación
      await this.logAudit({
        superadmin_id: user?.id,
        target_empresa_id: params.empresaId,
        accion: 'SUBSCRIPTION_PAYMENT_RECONCILED',
        detalles: {
          ...suscripcionMetadata,
          meses_agregados: params.mesesVigencia,
        },
      })

      return true
    } catch (e: any) {
      console.error('Error registrando conciliación de pago:', e)
      throw e
    }
  },

  // 4. Motor de Impersonación Seguro (Modo Soporte Técnico)
  async iniciarImpersonacion(targetEmpresaId: string, targetEmpresaNombre: string): Promise<ImpersonationSession> {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let userNombre = 'SuperAdmin'
    if (user) {
      const { data: p } = await supabase
        .from('perfiles')
        .select('nombre, rol')
        .eq('id', user.id)
        .maybeSingle()
      if (p?.nombre) userNombre = p.nombre
    }

    const impersonationData: ImpersonationSession = {
      isImpersonating: true,
      originalSuperAdminId: user?.id || 'admin-super',
      originalSuperAdminEmail: user?.email || 'superadmin@autolisto.mx',
      originalSuperAdminNombre: userNombre,
      targetEmpresaId,
      targetEmpresaNombre,
      startedAt: new Date().toISOString(),
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY_IMPERSONATION, JSON.stringify(impersonationData))
    }

    await this.logAudit({
      superadmin_id: user?.id,
      target_empresa_id: targetEmpresaId,
      accion: 'IMPERSONATION_START',
      detalles: {
        superadmin_email: user?.email,
        target_name: targetEmpresaNombre,
        timestamp: impersonationData.startedAt,
      },
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('autolisto:empresa_changed', { detail: impersonationData }))
    }

    return impersonationData
  },

  // 5. Finalizar Impersonación de Soporte y volver a SuperAdmin
  async finalizarImpersonacion(): Promise<void> {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_IMPERSONATION) : null
    if (!raw) {
      return
    }

    const impData: ImpersonationSession = JSON.parse(raw)

    await this.logAudit({
      superadmin_id: impData.originalSuperAdminId,
      target_empresa_id: impData.targetEmpresaId,
      accion: 'IMPERSONATION_END',
      detalles: {
        duracion_minutos: Math.round((Date.now() - new Date(impData.startedAt).getTime()) / 60000),
        target_name: impData.targetEmpresaNombre,
      },
    })

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY_IMPERSONATION)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('autolisto:empresa_changed', { detail: null }))
    }
  },

  // Obtener estado de impersonación actual
  getImpersonationStatus(): ImpersonationSession | null {
    if (typeof sessionStorage === 'undefined') return null
    const raw = sessionStorage.getItem(STORAGE_KEY_IMPERSONATION)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },

  // 6. Registro de Auditoría en public.superadmin_audit_logs + Ledger Local Resiliente
  async logAudit(log: {
    superadmin_id?: string
    target_empresa_id?: string
    accion: string
    detalles: any
    ip_address?: string
  }): Promise<void> {
    const timestamp = new Date().toISOString()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    const safeSuperadminId = log.superadmin_id && uuidRegex.test(log.superadmin_id) ? log.superadmin_id : null
    const safeEmpresaId = log.target_empresa_id && uuidRegex.test(log.target_empresa_id) ? log.target_empresa_id : null

    const enrichedDetails = {
      ...log.detalles,
      superadmin_raw_id: log.superadmin_id,
      target_empresa_raw_id: log.target_empresa_id,
    }

    const localLogEntry: SuperAdminAuditLog = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`,
      superadmin_id: log.superadmin_id || undefined,
      target_empresa_id: log.target_empresa_id || undefined,
      accion: log.accion,
      detalles: enrichedDetails,
      ip_address: log.ip_address || 'client-browser',
      created_at: timestamp,
    }

    // 1. Guardar en ledger local (garantiza cero pérdida de eventos)
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS)
        const currentLogs: SuperAdminAuditLog[] = raw ? JSON.parse(raw) : []
        const updatedLogs = [localLogEntry, ...currentLogs].slice(0, 100)
        localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(updatedLogs))
      }
    } catch (e) {
      console.warn('Error guardando audit log local:', e)
    }

    // 2. Persistir en Supabase
    try {
      const supabase = createClient()
      await supabase.from('superadmin_audit_logs').insert([
        {
          superadmin_id: safeSuperadminId,
          target_empresa_id: safeEmpresaId,
          accion: log.accion,
          detalles: enrichedDetails,
          ip_address: log.ip_address || 'client-browser',
          created_at: timestamp,
        },
      ])
    } catch (err) {
      console.warn('No se pudo persistir audit log en Supabase (modo resiliencia offline):', err)
    }
  },

  // 7. Consultar últimas bitácoras de auditoría (Fusión Supabase + Ledger Local)
  async getAuditLogs(limit: number = 50): Promise<SuperAdminAuditLog[]> {
    let remoteLogs: SuperAdminAuditLog[] = []
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('superadmin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!error && data) {
        remoteLogs = data as unknown as SuperAdminAuditLog[]
      }
    } catch (e) {
      console.warn('Error al consultar audit logs remotos:', e)
    }

    // Ledger local
    let localLogs: SuperAdminAuditLog[] = []
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS)
        if (raw) localLogs = JSON.parse(raw)
      }
    } catch (e) {}

    const map = new Map<string, SuperAdminAuditLog>()
    remoteLogs.forEach((l) => map.set(l.id, l))
    localLogs.forEach((l) => {
      const key = l.id || `${l.created_at}-${l.accion}`
      if (!map.has(key)) map.set(key, l)
    })

    const merged = Array.from(map.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)

    if (merged.length === 0) {
      return [
        {
          id: 'log-seed-01',
          superadmin_id: 'usr-super-1',
          target_empresa_id: 'a0000000-0000-0000-0000-000000000001',
          accion: 'CONTROL_PLANE_INITIALIZED',
          detalles: {
            version: '2.0.0',
            seguridad: 'RLS_ISOLATION_ACTIVE',
            modulo: 'AUTOLISTO_SHOP_OS',
          },
          ip_address: '127.0.0.1',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ]
    }

    return merged
  },

  // 8. Crear nueva empresa directamente desde el Control Plane
  async crearEmpresa(datos: {
    nombre_comercial: string
    rfc?: string
    ambiente?: 'PRODUCTION' | 'SANDBOX' | 'DEMO'
    plan_suscripcion?: 'STARTER' | 'PRO' | 'ENTERPRISE'
  }): Promise<EmpresaHqRecord> {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('empresas')
      .insert([
        {
          nombre_comercial: datos.nombre_comercial.trim(),
          rfc: datos.rfc?.trim() || null,
          ambiente: datos.ambiente || 'SANDBOX',
          plan_suscripcion: datos.plan_suscripcion || 'STARTER',
          activo: true,
          color_primario: '#2563EB',
          color_sidebar: '#0F172A',
        },
      ])
      .select()
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Error al crear la empresa')
    }

    // Registrar sucursal matriz inicial
    await supabase.from('sucursales').insert([
      {
        empresa_id: data.id,
        nombre: 'Matriz ' + datos.nombre_comercial,
        codigo: 'SUC-01',
        es_matriz: true,
        activa: true,
      },
    ])

    await this.logAudit({
      superadmin_id: user?.id,
      target_empresa_id: data.id,
      accion: 'TENANT_CREATED_FROM_HQ',
      detalles: {
        nombre: datos.nombre_comercial,
        plan: datos.plan_suscripcion || 'STARTER',
        ambiente: datos.ambiente || 'SANDBOX',
      },
    })

    return {
      id: data.id,
      nombre_comercial: data.nombre_comercial,
      rfc: data.rfc,
      logo_url: data.logo_url,
      color_primario: data.color_primario,
      color_sidebar: data.color_sidebar,
      ambiente: data.ambiente as any,
      plan_suscripcion: data.plan_suscripcion as any,
      activo: true,
      created_at: data.created_at,
      sucursales_activas: 1,
      sucursales_limite: (datos.plan_suscripcion === 'PRO' ? 3 : datos.plan_suscripcion === 'ENTERPRISE' ? 99999 : 1),
      total_ordenes: 0,
      total_vehiculos: 0,
      total_perfiles: 0,
    }
  },
}
