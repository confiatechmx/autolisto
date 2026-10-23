import { createClient } from '../lib/supabase/client'
import { applyThemeCssVariables } from '../context/TenantContext'

export interface TenantDomainInfo {
  id: string
  empresa_id: string
  domain: string
  is_primary: boolean
  verified: boolean
  custom_theme: {
    primary_color?: string | null
    sidebar_color?: string | null
    logo_url?: string | null
    app_title?: string | null
    favicon_url?: string | null
  }
  empresa?: {
    id: string
    nombre_comercial: string
    rfc: string | null
    logo_url: string | null
    color_primario: string | null
    color_sidebar: string | null
  }
}

export const tenantDomainService = {
  // Resuelve el tenant correspondiente según el hostname del navegador o query param test_domain
  async resolverTenantPorDominio(hostnameOverride?: string): Promise<TenantDomainInfo | null> {
    try {
      let hostname = (hostnameOverride || '').toLowerCase().trim()

      // Si no viene override explícito, verificar query param test_domain para pruebas locales
      if (!hostname && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const testDomain = urlParams.get('test_domain')
        if (testDomain) {
          hostname = testDomain.toLowerCase().trim()
        } else {
          hostname = (window.location.hostname || '').toLowerCase().trim()
        }
      }

      // En desarrollo local o dominios genéricos principales
      if (['localhost', '127.0.0.1', 'autolisto.mx', 'www.autolisto.mx', 'app.autolisto.mx'].includes(hostname)) {
        return null
      }

      // Check cache en sessionStorage para evitar roundtrips innecesarios
      const cacheKey = `autolisto_domain_${hostname}`
      if (typeof sessionStorage !== 'undefined') {
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as TenantDomainInfo
            if (parsed.custom_theme?.app_title && typeof document !== 'undefined') {
              document.title = `${parsed.custom_theme.app_title} | AutoListo Shop OS`
            }
            if (parsed.custom_theme?.primary_color || parsed.custom_theme?.sidebar_color) {
              applyThemeCssVariables(
                parsed.custom_theme.primary_color || '#2563EB',
                parsed.custom_theme.sidebar_color || '#0F172A'
              )
            }
            const fav = parsed.custom_theme?.favicon_url || parsed.custom_theme?.logo_url || parsed.empresa?.logo_url
            if (fav) this.aplicarFavicon(fav)
            return parsed
          } catch (e) {
            console.warn('Error leyendo cache de dominio:', e)
          }
        }
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from('tenant_domains')
        .select(`
          *,
          empresa:empresas(id, nombre_comercial, rfc, logo_url, color_primario, color_sidebar)
        `)
        .eq('domain', hostname)
        .eq('verified', true)
        .maybeSingle()

      if (!error && data) {
        const result = data as unknown as TenantDomainInfo
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(result))
        }

        if (result.custom_theme?.app_title && typeof document !== 'undefined') {
          document.title = `${result.custom_theme.app_title} | AutoListo Shop OS`
        }
        if (result.custom_theme?.primary_color || result.custom_theme?.sidebar_color) {
          applyThemeCssVariables(
            result.custom_theme.primary_color || '#2563EB',
            result.custom_theme.sidebar_color || '#0F172A'
          )
        }
        const fav = result.custom_theme?.favicon_url || result.custom_theme?.logo_url || result.empresa?.logo_url
        if (fav) this.aplicarFavicon(fav)

        return result
      }

      return null
    } catch (e) {
      console.warn('Error resolviendo dominio personalizado:', e)
      return null
    }
  },

  // Aplica dinámicamente el favicon en el DOM del navegador
  aplicarFavicon(faviconUrl?: string) {
    if (typeof document === 'undefined' || !faviconUrl) return
    try {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = faviconUrl
    } catch (e) {
      console.warn('No se pudo aplicar el favicon dinámico:', e)
    }
  },

  // Obtener lista de dominios asociados a una empresa
  async getDominiosEmpresa(empresaId: string): Promise<TenantDomainInfo[]> {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tenant_domains')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('is_primary', { ascending: false })

      if (!error && data) {
        return data as unknown as TenantDomainInfo[]
      }
      return []
    } catch (e) {
      console.error('Error al consultar dominios:', e)
      return []
    }
  },

  // Registrar o actualizar un dominio personalizado
  async registrarDominio(
    empresaId: string,
    domain: string,
    isPrimary: boolean,
    theme: {
      app_title?: string | null
      logo_url?: string | null
      favicon_url?: string | null
      primary_color?: string | null
      sidebar_color?: string | null
    }
  ): Promise<TenantDomainInfo> {
    const supabase = createClient()
    const cleanDomain = domain.toLowerCase().trim()

    // Si se marca como principal, desmarcar otros dominios de la misma empresa
    if (isPrimary) {
      await supabase
        .from('tenant_domains')
        .update({ is_primary: false })
        .eq('empresa_id', empresaId)
    }

    const { data, error } = await supabase
      .from('tenant_domains')
      .upsert(
        {
          empresa_id: empresaId,
          domain: cleanDomain,
          is_primary: isPrimary,
          verified: true,
          custom_theme: theme,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'domain' }
      )
      .select()
      .single()

    if (error) {
      throw new Error(error.message || 'Error al guardar el dominio')
    }

    return data as unknown as TenantDomainInfo
  },

  // Eliminar dominio personalizado
  async eliminarDominio(domainId: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase
      .from('tenant_domains')
      .delete()
      .eq('id', domainId)

    if (error) {
      throw new Error(error.message || 'Error al eliminar el dominio')
    }

    return true
  },

  // Marcar dominio como principal
  async marcarPrincipal(empresaId: string, domainId: string): Promise<boolean> {
    const supabase = createClient()

    // Desmarcar todos primero
    await supabase
      .from('tenant_domains')
      .update({ is_primary: false })
      .eq('empresa_id', empresaId)

    // Marcar el seleccionado
    const { error } = await supabase
      .from('tenant_domains')
      .update({ is_primary: true })
      .eq('id', domainId)

    if (error) {
      throw new Error(error.message || 'Error al actualizar dominio principal')
    }

    return true
  },

  // Verificación de DNS CNAME en vivo
  async verificarDnsEnVivo(domain: string): Promise<{ ok: boolean; message: string }> {
    try {
      const clean = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim()
      // Realizar consulta DoH (DNS over HTTPS de Google / Cloudflare)
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(clean)}&type=CNAME`, {
        headers: { Accept: 'application/dns-json' },
      })
      const data = await res.json()

      if (data.Answer && data.Answer.length > 0) {
        const cnameTarget = data.Answer[0].data || ''
        const isVercel = cnameTarget.includes('vercel') || cnameTarget.includes('autolisto')
        return {
          ok: isVercel,
          message: isVercel
            ? `DNS CNAME configurado correctamente hacia ${cnameTarget}`
            : `CNAME detectado apuntando a ${cnameTarget}. Debe apuntar a cname.autolisto.mx o Vercel.`,
        }
      }

      // Si no hay respuesta CNAME directa, verificar registro A
      const resA = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(clean)}&type=A`, {
        headers: { Accept: 'application/dns-json' },
      })
      const dataA = await resA.json()
      if (dataA.Answer && dataA.Answer.length > 0) {
        return {
          ok: true,
          message: `Dominio resuelto exitosamente vía dirección IP (${dataA.Answer[0].data}).`,
        }
      }

      return {
        ok: false,
        message: 'No se encontraron registros CNAME o A propagados para este dominio aún.',
      }
    } catch (e: any) {
      return {
        ok: false,
        message: 'Error en la consulta DNS: ' + (e.message || 'Verifica la conexión a internet'),
      }
    }
  }
}
