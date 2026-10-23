import { login, loginDemo } from './actions'
import { Gauge, Play, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedParams = await searchParams;
  return (
    <div className="min-h-screen w-full bg-[#0F172A] flex flex-col lg:flex-row">
      {/* Left Brand / Shopmonkey Operational Showcase */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-slate-800 bg-gradient-to-b from-slate-900 to-[#0B1120] text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-md flex items-center justify-center font-bold text-white shadow-sm">
            <Gauge size={20} />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight">AutoListo</span>
            <span className="ml-2 text-[10px] font-mono uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
              Shop OS
            </span>
          </div>
        </div>

        <div className="max-w-lg space-y-6">
          <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">
            El sistema operativo para talleres mecánicos y llanteras de alto rendimiento.
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Controla tus bahías en tiempo real, envía inspecciones digitales (DVI) por WhatsApp con aprobación en 1 clic, calcula márgenes de refacciones sobre pedido y liquida comisiones de mecánicos sin hojas de cálculo.
          </p>

          <div className="space-y-3 pt-2">
            {[
              "Tablero Workflow interactivo con tiempos de entrega y asignación de rampa",
              "Inspección Digital (DVI) con semáforo y Portal Público del Cliente (/orden/[id])",
              "Calculadora de margen en refacciones externas (Buyouts) y stock de llantas",
              "Control de Trabajos Diferidos, Caja Chica y Comisiones por Técnico",
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-300">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-6">
          <span>Arquitectura Multi-Tenant & White-Label</span>
          <span>Monterrey, N.L. • México</span>
        </div>
      </div>

      {/* Right Login & 1-Click Demo Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 bg-[#F4F5F7]">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white">
              <Gauge size={18} />
            </div>
            <span className="font-bold text-lg text-slate-900">AutoListo Shop OS</span>
          </div>

          {/* 1-Click Demo Banner (Recommended for immediate showcase) */}
          <div className="bg-white border-2 border-blue-600 rounded-lg p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded mb-1.5">
                  <Wrench size={11} /> Entorno Demo Precargado
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Torque & Ruta — Centro Automotriz
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Incluye 7 órdenes activas en Kanban, inspecciones DVI, inventario Michelin/BFGoodrich, flotillas y corte de caja.
                </p>
              </div>
            </div>
            <form>
              <button
                formAction={loginDemo}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2.5 text-xs font-semibold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play size={14} fill="currentColor" />
                Entrar como Demo en 1-Click (Sin Contraseña)
              </button>
            </form>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              O accede con tu cuenta
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Standard Login Form */}
          <form className="bg-white p-6 rounded-lg shadow-2xs border border-slate-200 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="email">
                Correo Electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue="demo@autolisto.mx"
                placeholder="servicio@torqueyruta.mx"
                required
                className="border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-md bg-white text-xs p-2.5 w-full transition-all text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                defaultValue="AutoListo2026!"
                placeholder="••••••••"
                required
                className="border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-md bg-white text-xs p-2.5 w-full transition-all text-slate-900 outline-none"
              />
            </div>

            <button
              formAction={login}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-md px-4 py-2.5 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              Iniciar Sesión con Credenciales
            </button>

            {resolvedParams?.message && (
              <p className="p-3 bg-red-50 text-red-700 text-center text-xs font-medium rounded-md border border-red-200">
                {resolvedParams.message}
              </p>
            )}
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck size={14} className="text-slate-400" />
            <span>Aislamiento de datos Multi-Tenant protegido con Supabase RLS</span>
          </div>
        </div>
      </div>
    </div>
  )
}
