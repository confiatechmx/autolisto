'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Printer,
  MessageCircle,
  Wrench,
  Package,
  Disc,
  Fuel,
  Gauge,
  MapPin,
  Phone,
  UserCheck,
  Calendar,
  FileText,
  Sparkles,
  ZoomIn,
  X,
  Check,
  History,
  CreditCard,
  Building2,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrdenData {
  id: string
  folio: number
  estado: string
  sub_estado: string | null
  prioridad: string | null
  estatus_pago: string | null
  nivel_gasolina: number | null
  kilometraje_ingreso: number | null
  problema_reportado: string | null
  diagnostico_tecnico: string | null
  notas_recepcion: string | null
  bahia_rampa: string | null
  fecha_promesa: string | null
  fecha_ingreso: string | null
  aprobado_cliente_at: string | null
  aprobado_cliente_nombre: string | null
  checklist_recepcion: Record<string, boolean> | null
}

interface EmpresaData {
  id: string
  nombre_comercial: string
  rfc: string | null
  direccion: string | null
  tasa_iva: number | null
  logo_url: string | null
  color_primario: string | null
  color_sidebar: string | null
  eslogan: string | null
  telefono: string | null
  email_contacto: string | null
  sitio_web: string | null
  terminos_condiciones: string | null
}

interface SucursalData {
  id: string
  nombre: string
  codigo: string | null
  direccion: string | null
  telefono: string | null
  gerente: string | null
}

interface VehiculoData {
  id: string
  marca: string
  modelo: string
  anio: number | null
  placas: string | null
  vin: string | null
  color: string | null
  kilometraje_actual: number | null
  medida_oem: string | null
}

interface ClienteData {
  id: string
  nombre: string
  telefono: string | null
  correo: string | null
  empresa: string | null
  rfc: string | null
}

interface MecanicoData {
  id: string
  nombre: string
  puesto: string | null
  especialidad: string | null
  color_avatar: string | null
}

interface AsesorData {
  id: string
  nombre: string
  puesto: string | null
  telefono: string | null
}

interface ServicioItem {
  id: string
  precio_cobrado: number
  cantidad: number
  horas_labor: number | null
  estatus_aprobacion: string | null
  notas: string | null
  servicio: {
    id: string
    nombre: string
    descripcion: string | null
    categoria: string | null
    codigo_sku: string | null
  } | null
}

interface RefaccionItem {
  id: string
  nombre: string
  numero_parte: string | null
  proveedor: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  estatus_aprobacion: string | null
}

interface LlantaItem {
  id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  estatus_aprobacion: string | null
  llanta: {
    id: string
    marca: string
    modelo_llanta: string
    ancho: number
    perfil: number
    rin: number
  } | null
}

interface DviItem {
  id: string
  categoria: string
  punto_inspeccion: string
  severidad: 'verde' | 'amarillo' | 'rojo'
  observaciones: string | null
  recomendacion: string | null
  costo_estimado: number | null
  foto_url: string | null
  estatus_cliente: string | null
}

interface PagoItem {
  id: string
  monto_total: number
  proveedor_pago: string | null
  metodo_detalle: string | null
  referencia: string | null
  estatus: string | null
  fecha_pago: string | null
}

interface PortalResponse {
  orden: OrdenData
  empresa: EmpresaData | null
  sucursal: SucursalData | null
  vehiculo: VehiculoData | null
  cliente: ClienteData | null
  mecanico: MecanicoData | null
  asesor: AsesorData | null
  servicios: ServicioItem[]
  refacciones: RefaccionItem[]
  llantas: LlantaItem[]
  dvi: DviItem[]
  pagos: PagoItem[]
}

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const STAGES = [
  {
    key: 'Citas del Día',
    title: 'Citas del Día',
    subtitle: 'Recepción y Check-in',
    description: 'Vehículo recibido y registrado en sistema',
  },
  {
    key: 'En Inspección',
    title: 'En Inspección',
    subtitle: 'Diagnóstico Multipunto DVI',
    description: 'Evaluación técnica digital con evidencia fotográfica',
  },
  {
    key: 'En Rampa',
    title: 'En Rampa',
    subtitle: 'En Reparación / Servicio',
    description: 'Técnico ejecutando los trabajos autorizados',
  },
  {
    key: 'Listo para Entrega',
    title: 'Listo para Entrega',
    subtitle: 'Control de Calidad Completado',
    description: 'Unidad verificada y lista para su recolección',
  },
]

function formatCurrency(amount: number | null | undefined): string {
  const num = Number(amount || 0)
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(num)
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function getStageIndex(estado: string | null | undefined): number {
  if (!estado) return 0
  const idx = STAGES.findIndex(
    (s) => s.key.toLowerCase() === estado.trim().toLowerCase()
  )
  if (idx !== -1) return idx
  if (estado.toLowerCase().includes('entregado')) return 3
  return 0
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'TL'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdenCustomerPortalPage() {
  const params = useParams<{ id: string }>()
  const orderId = params?.id

  const [data, setData] = useState<PortalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Approval selections: maps item ID -> boolean (true = Autorizar ahora, false = Diferir)
  const [approvedServicios, setApprovedServicios] = useState<Record<string, boolean>>({})
  const [approvedRefacciones, setApprovedRefacciones] = useState<Record<string, boolean>>({})
  const [approvedLlantas, setApprovedLlantas] = useState<Record<string, boolean>>({})

  // Signature & Terms state
  const [signerName, setSignerName] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [submittingApproval, setSubmittingApproval] = useState(false)
  const [justApprovedBanner, setJustApprovedBanner] = useState(false)

  // DVI Filter & Photo Lightbox
  const [dviFilter, setDviFilter] = useState<'todos' | 'rojo' | 'amarillo' | 'verde'>('todos')
  const [zoomedPhoto, setZoomedPhoto] = useState<{
    url: string
    title: string
    obs: string | null
  } | null>(null)

  const fetchPortalData = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
      const { data: rpcData, error } = await supabase.rpc(
        'obtener_orden_portal_publico',
        { p_orden_id: orderId }
      )

      if (error) {
        throw new Error(error.message)
      }
      if (!rpcData || !rpcData.orden) {
        throw new Error('No se encontró la orden de servicio solicitada.')
      }

      const portal = rpcData as PortalResponse
      setData(portal)

      // Initialize approval toggles from current database state
      const srvMap: Record<string, boolean> = {}
      ;(portal.servicios || []).forEach((s) => {
        srvMap[s.id] =
          s.estatus_aprobacion !== 'Diferido' && s.estatus_aprobacion !== 'Rechazado'
      })
      setApprovedServicios(srvMap)

      const refMap: Record<string, boolean> = {}
      ;(portal.refacciones || []).forEach((r) => {
        refMap[r.id] =
          r.estatus_aprobacion !== 'Diferido' && r.estatus_aprobacion !== 'Rechazado'
      })
      setApprovedRefacciones(refMap)

      const llaMap: Record<string, boolean> = {}
      ;(portal.llantas || []).forEach((l) => {
        llaMap[l.id] =
          l.estatus_aprobacion !== 'Diferido' && l.estatus_aprobacion !== 'Rechazado'
      })
      setApprovedLlantas(llaMap)

      setSignerName(
        portal.orden.aprobado_cliente_nombre || portal.cliente?.nombre || ''
      )
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar el portal de la orden.'
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchPortalData()
  }, [fetchPortalData])

  // ─── Computed Totals & Counts ───────────────────────────────────────────────

  const dviCounts = useMemo(() => {
    const list = data?.dvi || []
    return {
      rojo: list.filter((i) => i.severidad === 'rojo').length,
      amarillo: list.filter((i) => i.severidad === 'amarillo').length,
      verde: list.filter((i) => i.severidad === 'verde').length,
      total: list.length,
    }
  }, [data?.dvi])

  const filteredDvi = useMemo(() => {
    const list = data?.dvi || []
    if (dviFilter === 'todos') return list
    return list.filter((i) => i.severidad === dviFilter)
  }, [data?.dvi, dviFilter])

  const financials = useMemo(() => {
    if (!data) {
      return {
        subtotalAutorizado: 0,
        ivaAutorizado: 0,
        totalAutorizadoHoy: 0,
        montoDiferido: 0,
        pagosRegistrados: 0,
        saldoPorLiquidar: 0,
        authorizedCount: 0,
        deferredCount: 0,
        totalItemsCount: 0,
      }
    }

    const tasaIva = Number(data.empresa?.tasa_iva ?? 16) / 100
    let subtotalAutorizado = 0
    let subtotalDiferido = 0
    let authorizedCount = 0
    let deferredCount = 0

    for (const s of data.servicios || []) {
      const lineTotal = Number(s.precio_cobrado || 0) * Number(s.cantidad || 1)
      if (approvedServicios[s.id] !== false) {
        subtotalAutorizado += lineTotal
        authorizedCount++
      } else {
        subtotalDiferido += lineTotal
        deferredCount++
      }
    }

    for (const r of data.refacciones || []) {
      const lineTotal =
        r.subtotal != null
          ? Number(r.subtotal)
          : Number(r.precio_unitario || 0) * Number(r.cantidad || 1)
      if (approvedRefacciones[r.id] !== false) {
        subtotalAutorizado += lineTotal
        authorizedCount++
      } else {
        subtotalDiferido += lineTotal
        deferredCount++
      }
    }

    for (const l of data.llantas || []) {
      const lineTotal =
        l.subtotal != null
          ? Number(l.subtotal)
          : Number(l.precio_unitario || 0) * Number(l.cantidad || 1)
      if (approvedLlantas[l.id] !== false) {
        subtotalAutorizado += lineTotal
        authorizedCount++
      } else {
        subtotalDiferido += lineTotal
        deferredCount++
      }
    }

    const totalAutorizadoHoy = subtotalAutorizado
    const subtotalSinIva = totalAutorizadoHoy / (1 + tasaIva)
    const ivaAutorizado = totalAutorizadoHoy - subtotalSinIva
    const montoDiferido = subtotalDiferido

    const pagosRegistrados = (data.pagos || [])
      .filter((p) => !p.estatus || p.estatus.toLowerCase() !== 'cancelado')
      .reduce((acc, p) => acc + Number(p.monto_total || 0), 0)

    const saldoPorLiquidar = Math.max(0, totalAutorizadoHoy - pagosRegistrados)

    return {
      subtotalAutorizado: subtotalSinIva,
      ivaAutorizado,
      totalAutorizadoHoy,
      montoDiferido,
      pagosRegistrados,
      saldoPorLiquidar,
      authorizedCount,
      deferredCount,
      totalItemsCount: authorizedCount + deferredCount,
    }
  }, [data, approvedServicios, approvedRefacciones, approvedLlantas])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleAll = (approve: boolean) => {
    if (!data) return
    const srvMap: Record<string, boolean> = {}
    ;(data.servicios || []).forEach((s) => (srvMap[s.id] = approve))
    setApprovedServicios(srvMap)

    const refMap: Record<string, boolean> = {}
    ;(data.refacciones || []).forEach((r) => (refMap[r.id] = approve))
    setApprovedRefacciones(refMap)

    const llaMap: Record<string, boolean> = {}
    ;(data.llantas || []).forEach((l) => (llaMap[l.id] = approve))
    setApprovedLlantas(llaMap)
  }

  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data || !orderId) return

    const trimmedName = signerName.trim()
    if (!trimmedName) {
      toast.error('Por favor ingresa el nombre completo de quien autoriza.')
      return
    }
    if (!acceptedTerms) {
      toast.error('Debes aceptar los términos y condiciones del taller para continuar.')
      return
    }

    setSubmittingApproval(true)
    try {
      const supabase = createClient()

      const p_servicios_diferidos = (data.servicios || [])
        .filter((s) => approvedServicios[s.id] === false)
        .map((s) => s.id)

      const p_refacciones_diferidas = (data.refacciones || [])
        .filter((r) => approvedRefacciones[r.id] === false)
        .map((r) => r.id)

      const p_llantas_diferidas = (data.llantas || [])
        .filter((l) => approvedLlantas[l.id] === false)
        .map((l) => l.id)

      const { error } = await supabase.rpc('procesar_aprobacion_portal_cliente', {
        p_orden_id: orderId,
        p_servicios_diferidos,
        p_refacciones_diferidas,
        p_llantas_diferidas,
        p_nombre_firma: trimmedName,
      })

      if (error) {
        throw new Error(error.message)
      }

      setJustApprovedBanner(true)
      toast.success('¡Orden autorizada exitosamente! El taller ha sido notificado.')
      await fetchPortalData()
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo procesar la autorización.'
      toast.error(msg)
    } finally {
      setSubmittingApproval(false)
    }
  }

  // ─── Loading & Error States ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Car className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            Cargando Portal Digital del Vehículo...
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Sincronizando estado en vivo, inspección multipunto y cotización.
          </p>
        </div>
      </div>
    )
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Orden no disponible
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            {errorMsg || 'No pudimos encontrar la orden solicitada.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={fetchPortalData}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <Link
              href="/tablero"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              Ir al Tablero
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const {
    orden,
    empresa,
    sucursal,
    vehiculo,
    cliente,
    mecanico,
    asesor,
    servicios = [],
    refacciones = [],
    llantas = [],
    pagos = [],
  } = data

  const brandSidebar = empresa?.color_sidebar || '#0f172a'
  const brandPrimary = empresa?.color_primario || '#0284c7'
  const folioDisplay = `#${1000 + Number(orden.folio || 1)}`
  const currentStageIndex = getStageIndex(orden.estado)

  // Build WhatsApp URL
  const rawPhone =
    sucursal?.telefono || empresa?.telefono || asesor?.telefono || '5500000000'
  const cleanPhone = rawPhone.replace(/\D/g, '')
  const waPhone = cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`
  const waMessage = encodeURIComponent(
    `Hola ${empresa?.nombre_comercial || 'Taller'}, tengo una consulta sobre mi vehículo ${
      vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : ''
    } con Orden de Servicio ${folioDisplay}.`
  )
  const whatsappUrl = `https://wa.me/${waPhone}?text=${waMessage}`

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20 print:bg-white print:pb-0">
      {/* ─── Subtle Demo Top Bar ────────────────────────────────────────────── */}
      <div className="bg-slate-950 text-slate-300 text-xs border-b border-slate-800 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between">
          <Link
            href={`/tablero?ordenId=${orden.id}`}
            className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver al Tablero del Taller</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Portal Digital del Cliente (White-Label)
            </span>
            <button
              onClick={fetchPortalData}
              title="Actualizar estado"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sincronizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Dynamic White-Label Workshop Header ────────────────────────────── */}
      <header
        style={{ backgroundColor: brandSidebar }}
        className="text-white border-b border-slate-800 print:bg-slate-900 print:text-slate-900"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            {/* Brand Identity */}
            <div className="flex items-start sm:items-center gap-4">
              {empresa?.logo_url ? (
                <img
                  src={empresa.logo_url}
                  alt={empresa.nombre_comercial}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain bg-white p-1.5 shrink-0 border border-white/15"
                />
              ) : (
                <div
                  style={{ backgroundColor: brandPrimary }}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl tracking-tight shrink-0 shadow-sm border border-white/15"
                >
                  {getInitials(empresa?.nombre_comercial)}
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    {empresa?.nombre_comercial || 'Centro de Servicio Automotriz'}
                  </h1>
                  {sucursal?.nombre && (
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-white/10 text-slate-100 border border-white/15">
                      Sucursal {sucursal.nombre}
                    </span>
                  )}
                </div>

                {empresa?.eslogan && (
                  <p className="text-sm text-slate-300 mt-0.5">{empresa.eslogan}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-2">
                  {(sucursal?.direccion || empresa?.direccion) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {sucursal?.direccion || empresa?.direccion}
                    </span>
                  )}
                  {(sucursal?.telefono || empresa?.telefono) && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {sucursal?.telefono || empresa?.telefono}
                    </span>
                  )}
                  {empresa?.rfc && (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      RFC: {empresa.rfc}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Taller</span>
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/15 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Container ─────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Official Digital Approval Banner (if already approved) */}
        {(orden.aprobado_cliente_at || justApprovedBanner) && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-200/70 text-emerald-900">
                    Firma Digital Verificada
                  </span>
                  <span className="text-xs text-emerald-700 font-medium">
                    Orden {folioDisplay}
                  </span>
                </div>
                <p className="text-sm sm:text-base font-bold text-emerald-950 mt-1">
                  Cotización Autorizada Digitalmente por{' '}
                  <span className="underline decoration-emerald-500">
                    {orden.aprobado_cliente_nombre || signerName || cliente?.nombre}
                  </span>{' '}
                  el {formatDateTime(orden.aprobado_cliente_at || new Date().toISOString())}
                </p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  El equipo técnico ha recibido tu autorización y los conceptos diferidos quedaron programados para tu próxima visita.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Section 1: Domino's-Style Live Vehicle Tracker ───────────────── */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Order & Vehicle Top Bar */}
          <div className="p-5 sm:p-6 border-b border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    style={{ backgroundColor: brandPrimary }}
                    className="px-3 py-1 rounded-lg text-white font-bold text-sm tracking-wide"
                  >
                    Orden {folioDisplay}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {orden.estado}
                  </span>
                  {orden.sub_estado && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      {orden.sub_estado}
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2.5 flex flex-wrap items-center gap-2.5">
                  <span>
                    {vehiculo
                      ? `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio || ''}`
                      : 'Vehículo en Servicio'}
                  </span>
                  {vehiculo?.placas && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-amber-100 border-2 border-slate-900 text-slate-900 font-mono text-sm font-extrabold tracking-widest uppercase">
                      {vehiculo.placas}
                    </span>
                  )}
                </h2>

                {cliente && (
                  <p className="text-sm text-slate-500 mt-1">
                    Cliente:{' '}
                    <span className="font-semibold text-slate-700">
                      {cliente.nombre}
                    </span>
                    {cliente.empresa ? ` (${cliente.empresa})` : ''}
                  </p>
                )}
              </div>

              {/* Dates Summary */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs">
                <div className="pr-3 sm:border-r border-slate-200">
                  <span className="text-slate-400 block font-medium">Ingreso</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {formatDateTime(orden.fecha_ingreso)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">
                    Entrega Estimada
                  </span>
                  <span className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-sky-600" />
                    {formatDateTime(orden.fecha_promesa)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4-Stage Domino's Progress Tracker */}
            <div className="mt-7">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Progreso en Vivo de tu Vehículo
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  Etapa {currentStageIndex + 1} de {STAGES.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
                {STAGES.map((stage, index) => {
                  const isCompleted = index < currentStageIndex
                  const isCurrent = index === currentStageIndex

                  return (
                    <div
                      key={stage.key}
                      className={`relative rounded-xl p-3.5 border transition-all ${
                        isCurrent
                          ? 'bg-sky-50/70 border-sky-500 shadow-xs'
                          : isCompleted
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-slate-50/70 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-sky-600 text-white ring-4 ring-sky-100'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-ping" />
                            Actual
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            Completado
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-sm font-bold ${
                          isCurrent
                            ? 'text-slate-900'
                            : isCompleted
                            ? 'text-slate-800'
                            : 'text-slate-500'
                        }`}
                      >
                        {stage.title}
                      </p>
                      <p className="text-xs font-medium text-slate-600 mt-0.5">
                        {stage.subtitle}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        {stage.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Vehicle Telemetry & Assigned Team Strip */}
          <div className="bg-slate-50/80 px-5 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs border-b border-slate-100">
            <div>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                VIN / Serie
              </span>
              <span className="font-mono font-semibold text-slate-800 mt-0.5 block truncate">
                {vehiculo?.vin || 'No registrado'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5" />
                Kilometraje Ingreso
              </span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {orden.kilometraje_ingreso != null
                  ? `${Number(orden.kilometraje_ingreso).toLocaleString('es-MX')} km`
                  : '—'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5" />
                Nivel Combustible
              </span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {orden.nivel_gasolina != null ? `${orden.nivel_gasolina}` : '—'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5" />
                Bahía / Rampa
              </span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {orden.bahia_rampa || 'Asignación general'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                Técnico Asignado
              </span>
              <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                {mecanico?.nombre || 'Por asignar'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                Asesor de Servicio
              </span>
              <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                {asesor?.nombre || 'Atención Clientes'}
              </span>
            </div>
          </div>

          {/* Reported Problem & Technical Diagnosis */}
          {(orden.problema_reportado || orden.diagnostico_tecnico) && (
            <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
              {orden.problema_reportado && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Motivo de Ingreso / Reporte del Cliente
                  </span>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {orden.problema_reportado}
                  </p>
                </div>
              )}
              {orden.diagnostico_tecnico && (
                <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200/80">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-800 block mb-1">
                    Diagnóstico Técnico del Especialista
                  </span>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {orden.diagnostico_tecnico}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ─── Section 2: Digital Vehicle Inspection (DVI) Report ───────────── */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-md mb-2">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Inspección Digital Multipunto (DVI)
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  Reporte de Salud de tu Vehículo
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Revisión visual y técnica realizada por nuestro especialista con evidencia transparente.
                </p>
              </div>

              {/* Summary Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDviFilter(dviFilter === 'rojo' ? 'todos' : 'rojo')
                  }
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    dviFilter === 'rojo'
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                  }`}
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Atención Inmediata ({dviCounts.rojo})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDviFilter(dviFilter === 'amarillo' ? 'todos' : 'amarillo')
                  }
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    dviFilter === 'amarillo'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Precaución / Próximo Servicio ({dviCounts.amarillo})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDviFilter(dviFilter === 'verde' ? 'todos' : 'verde')
                  }
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    dviFilter === 'verde'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>En Buen Estado ({dviCounts.verde})</span>
                </button>

                {dviFilter !== 'todos' && (
                  <button
                    type="button"
                    onClick={() => setDviFilter('todos')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline ml-1"
                  >
                    Ver todos ({dviCounts.total})
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {filteredDvi.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  {dviCounts.total === 0
                    ? 'La inspección multipunto aún está en proceso.'
                    : 'No hay puntos de inspección bajo este filtro.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDvi.map((item) => {
                  const isRed = item.severidad === 'rojo'
                  const isYellow = item.severidad === 'amarillo'

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-shadow hover:shadow-xs ${
                        isRed
                          ? 'bg-red-50/30 border-red-200'
                          : isYellow
                          ? 'bg-amber-50/30 border-amber-200'
                          : 'bg-slate-50/50 border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                              {item.categoria}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                              {item.punto_inspeccion}
                            </h4>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                              isRed
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : isYellow
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isRed ? (
                              <>
                                <AlertOctagon className="w-3.5 h-3.5" />
                                Atención Inmediata
                              </>
                            ) : isYellow ? (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Precaución
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Buen Estado
                              </>
                            )}
                          </span>
                        </div>

                        {item.observaciones && (
                          <p className="text-xs text-slate-700 mt-2.5 bg-white/80 p-2.5 rounded-lg border border-slate-200/70">
                            <strong className="font-semibold text-slate-900">
                              Hallazgo:{' '}
                            </strong>
                            {item.observaciones}
                          </p>
                        )}

                        {item.recomendacion && (
                          <p className="text-xs text-slate-600 mt-2">
                            <strong className="font-semibold text-slate-800">
                              Recomendación técnica:{' '}
                            </strong>
                            {item.recomendacion}
                          </p>
                        )}
                      </div>

                      {/* Photo & Estimated Cost Footer */}
                      {(item.foto_url ||
                        (item.costo_estimado && Number(item.costo_estimado) > 0)) && (
                        <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-3">
                          {item.foto_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                setZoomedPhoto({
                                  url: item.foto_url!,
                                  title: `${item.categoria} — ${item.punto_inspeccion}`,
                                  obs: item.observaciones,
                                })
                              }
                              className="group inline-flex items-center gap-2.5 text-left"
                            >
                              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shrink-0">
                                <img
                                  src={item.foto_url}
                                  alt={item.punto_inspeccion}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <ZoomIn className="w-4 h-4 text-white" />
                                </div>
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-sky-700 group-hover:underline block">
                                  Ver evidencia fotográfica
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Clic para ampliar imagen
                                </span>
                              </div>
                            </button>
                          ) : (
                            <span />
                          )}

                          {item.costo_estimado != null &&
                            Number(item.costo_estimado) > 0 && (
                              <div className="text-right">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                  Est. Reparación
                                </span>
                                <span className="text-sm font-bold text-slate-900">
                                  {formatCurrency(item.costo_estimado)}
                                </span>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* ─── Section 3: Interactive Quote & 1-Click Line-Item Approval ───── */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Presupuesto Interactivo y Autorización 1-Click
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  Desglose de Servicios, Refacciones y Neumáticos
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Marca los trabajos que deseas autorizar hoy. Los conceptos que desmarques se guardarán en tu historial para tu próxima visita.
                </p>
              </div>

              {financials.totalItemsCount > 0 && (
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => handleToggleAll(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                  >
                    Autorizar Todo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAll(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    Diferir Todo
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {/* Mano de Obra / Servicios */}
            {servicios.length > 0 && (
              <div className="p-5 sm:p-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-4">
                  <Wrench className="w-4 h-4 text-slate-700" />
                  Servicios y Mano de Obra ({servicios.length})
                </h4>
                <div className="space-y-3">
                  {servicios.map((item) => {
                    const isChecked = approvedServicios[item.id] !== false
                    const lineTotal =
                      Number(item.precio_cobrado || 0) * Number(item.cantidad || 1)

                    return (
                      <div
                        key={item.id}
                        onClick={() =>
                          setApprovedServicios((prev) => ({
                            ...prev,
                            [item.id]: !isChecked,
                          }))
                        }
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          isChecked
                            ? 'bg-white border-slate-200 hover:border-slate-300'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-sm font-bold ${
                                    isChecked
                                      ? 'text-slate-900'
                                      : 'text-slate-600 line-through'
                                  }`}
                                >
                                  {item.servicio?.nombre || 'Servicio Técnico'}
                                </span>
                                {item.servicio?.categoria && (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                    {item.servicio.categoria}
                                  </span>
                                )}
                              </div>
                              {item.servicio?.descripcion && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {item.servicio.descripcion}
                                </p>
                              )}
                              {item.notas && (
                                <p className="text-xs text-slate-600 mt-1 italic">
                                  Nota: {item.notas}
                                </p>
                              )}

                              {/* Status Explanation Pill */}
                              <div className="mt-2">
                                {isChecked ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Autorizar ahora
                                  </span>
                                ) : (
                                  <div className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                                    <History className="w-3.5 h-3.5 shrink-0" />
                                    <span>Diferir para próxima visita:</span>
                                    <span className="font-normal text-amber-800">
                                      Se guardará en el historial de tu auto como recordatorio para tu siguiente visita
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right sm:shrink-0 pl-8 sm:pl-0">
                            <span className="text-xs text-slate-400 block">
                              Cant. {item.cantidad || 1} ×{' '}
                              {formatCurrency(item.precio_cobrado)}
                            </span>
                            <span
                              className={`text-base font-bold ${
                                isChecked ? 'text-slate-900' : 'text-amber-800'
                              }`}
                            >
                              {formatCurrency(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Refacciones / Partes */}
            {refacciones.length > 0 && (
              <div className="p-5 sm:p-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 text-slate-700" />
                  Refacciones e Insumos ({refacciones.length})
                </h4>
                <div className="space-y-3">
                  {refacciones.map((item) => {
                    const isChecked = approvedRefacciones[item.id] !== false
                    const lineTotal =
                      item.subtotal != null
                        ? Number(item.subtotal)
                        : Number(item.precio_unitario || 0) *
                          Number(item.cantidad || 1)

                    return (
                      <div
                        key={item.id}
                        onClick={() =>
                          setApprovedRefacciones((prev) => ({
                            ...prev,
                            [item.id]: !isChecked,
                          }))
                        }
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          isChecked
                            ? 'bg-white border-slate-200 hover:border-slate-300'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-sm font-bold ${
                                    isChecked
                                      ? 'text-slate-900'
                                      : 'text-slate-600 line-through'
                                  }`}
                                >
                                  {item.nombre}
                                </span>
                                {item.numero_parte && (
                                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                    NP: {item.numero_parte}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2">
                                {isChecked ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Autorizar ahora
                                  </span>
                                ) : (
                                  <div className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                                    <History className="w-3.5 h-3.5 shrink-0" />
                                    <span>Diferir para próxima visita:</span>
                                    <span className="font-normal text-amber-800">
                                      Se guardará en el historial de tu auto como recordatorio para tu siguiente visita
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right sm:shrink-0 pl-8 sm:pl-0">
                            <span className="text-xs text-slate-400 block">
                              Cant. {item.cantidad} ×{' '}
                              {formatCurrency(item.precio_unitario)}
                            </span>
                            <span
                              className={`text-base font-bold ${
                                isChecked ? 'text-slate-900' : 'text-amber-800'
                              }`}
                            >
                              {formatCurrency(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Llantas / Neumáticos */}
            {llantas.length > 0 && (
              <div className="p-5 sm:p-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-4">
                  <Disc className="w-4 h-4 text-slate-700" />
                  Neumáticos / Llantas ({llantas.length})
                </h4>
                <div className="space-y-3">
                  {llantas.map((item) => {
                    const isChecked = approvedLlantas[item.id] !== false
                    const lineTotal =
                      item.subtotal != null
                        ? Number(item.subtotal)
                        : Number(item.precio_unitario || 0) *
                          Number(item.cantidad || 1)
                    const label = item.llanta
                      ? `${item.llanta.marca} ${item.llanta.modelo_llanta} (${item.llanta.ancho}/${item.llanta.perfil} R${item.llanta.rin})`
                      : 'Neumático'

                    return (
                      <div
                        key={item.id}
                        onClick={() =>
                          setApprovedLlantas((prev) => ({
                            ...prev,
                            [item.id]: !isChecked,
                          }))
                        }
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          isChecked
                            ? 'bg-white border-slate-200 hover:border-slate-300'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <span
                                className={`text-sm font-bold block ${
                                  isChecked
                                    ? 'text-slate-900'
                                    : 'text-slate-600 line-through'
                                }`}
                              >
                                {label}
                              </span>

                              <div className="mt-2">
                                {isChecked ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Autorizar ahora
                                  </span>
                                ) : (
                                  <div className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                                    <History className="w-3.5 h-3.5 shrink-0" />
                                    <span>Diferir para próxima visita:</span>
                                    <span className="font-normal text-amber-800">
                                      Se guardará en el historial de tu auto como recordatorio para tu siguiente visita
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right sm:shrink-0 pl-8 sm:pl-0">
                            <span className="text-xs text-slate-400 block">
                              Cant. {item.cantidad} ×{' '}
                              {formatCurrency(item.precio_unitario)}
                            </span>
                            <span
                              className={`text-base font-bold ${
                                isChecked ? 'text-slate-900' : 'text-amber-800'
                              }`}
                            >
                              {formatCurrency(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Financial Summary & Digital Signature Box */}
            <div className="p-5 sm:p-6 bg-slate-50/70">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Live Financial Breakdown */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-slate-700" />
                    Resumen Financiero en Vivo
                  </h4>

                  <div className="space-y-2 text-sm pt-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal Autorizado ({financials.authorizedCount} conceptos)</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(financials.subtotalAutorizado)}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>IVA ({empresa?.tasa_iva ?? 16}%)</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(financials.ivaAutorizado)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                      <span className="font-bold text-slate-900">
                        Total Autorizado Hoy
                      </span>
                      <span className="text-xl font-extrabold text-emerald-700">
                        {formatCurrency(financials.totalAutorizadoHoy)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                      <span className="font-semibold text-amber-900">
                        Monto Diferido para Próxima Visita ({financials.deferredCount})
                      </span>
                      <span className="font-bold text-amber-900">
                        {formatCurrency(financials.montoDiferido)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between text-slate-600">
                      <span>Pagos / Anticipos Registrados</span>
                      <span className="font-semibold text-sky-700">
                        - {formatCurrency(financials.pagosRegistrados)}
                      </span>
                    </div>

                    <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
                      <span className="font-bold text-slate-900">
                        Saldo por Liquidar
                      </span>
                      <span className="text-lg font-extrabold text-slate-900">
                        {formatCurrency(financials.saldoPorLiquidar)}
                      </span>
                    </div>
                  </div>

                  {/* Registered Payments History if any */}
                  {pagos.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Pagos Aplicados
                      </span>
                      <div className="space-y-1">
                        {pagos.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-xs text-slate-600"
                          >
                            <span>
                              {p.proveedor_pago || 'Pago'}{' '}
                              {p.referencia ? `(${p.referencia})` : ''}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {formatCurrency(p.monto_total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Digital Authorization Box */}
                <form
                  onSubmit={handleConfirmApproval}
                  className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-2xs space-y-4 print:hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        Firma y Autorización Digital del Cliente
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Al confirmar, autorizas al taller a iniciar los trabajos seleccionados ({financials.authorizedCount}) y guardar los diferidos ({financials.deferredCount}) para tu siguiente servicio.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="signer-name"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Nombre completo de quien autoriza *
                    </label>
                    <input
                      id="signer-name"
                      type="text"
                      required
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Ej. Roberto Sánchez Morales"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>

                  {/* Terms & Conditions Acceptance */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-xs text-slate-700 leading-relaxed">
                        He revisado el diagnóstico digital multipunto y acepto el presupuesto por{' '}
                        <strong className="text-slate-900">
                          {formatCurrency(financials.totalAutorizadoHoy)}
                        </strong>{' '}
                        así como los términos y condiciones de servicio de{' '}
                        <strong className="text-slate-900">
                          {empresa?.nombre_comercial || 'el taller'}
                        </strong>
                        .
                      </span>
                    </label>

                    {empresa?.terminos_condiciones && (
                      <div className="mt-2 pl-6">
                        <button
                          type="button"
                          onClick={() => setShowTermsModal(!showTermsModal)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                        >
                          {showTermsModal ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              Ocultar términos y condiciones
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              Ver términos y condiciones del taller
                            </>
                          )}
                        </button>
                        {showTermsModal && (
                          <p className="mt-2 text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                            {empresa.terminos_condiciones}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submittingApproval}
                    style={{ backgroundColor: brandPrimary }}
                    className="w-full py-3.5 px-5 rounded-xl text-white font-bold text-sm sm:text-base shadow-sm hover:opacity-95 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submittingApproval ? (
                      <>
                        <Clock className="w-5 h-5 animate-spin" />
                        <span>Procesando Firma Digital...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>
                          {orden.aprobado_cliente_at
                            ? 'Actualizar y Re-Confirmar Orden de Servicio'
                            : 'Confirmar y Autorizar Orden de Servicio'}
                        </span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Lightbox Modal for DVI Photo Zoom ──────────────────────────────── */}
      {zoomedPhoto && (
        <div
          onClick={() => setZoomedPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                {zoomedPhoto.title}
              </h4>
              <button
                type="button"
                onClick={() => setZoomedPhoto(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-900 flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={zoomedPhoto.url}
                alt={zoomedPhoto.title}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            </div>
            {zoomedPhoto.obs && (
              <div className="p-4 bg-slate-50 text-xs text-slate-700">
                <strong className="text-slate-900">Observación técnica: </strong>
                {zoomedPhoto.obs}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
