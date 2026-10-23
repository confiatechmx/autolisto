import { describe, it, expect, beforeEach, vi } from "vitest";
import { saasHqService, ImpersonationSession } from "../services/saasHqService";
import { tenantDomainService } from "../services/tenantDomainService";

// Mock Supabase Client
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn();

vi.mock("../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "usr-superadmin-01",
            email: "superadmin@autolisto.mx",
          },
        },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn((table: string) => {
      if (table === "empresas") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "empresa-01",
                  nombre_comercial: "Torque & Ruta",
                  rfc: "TRC2105148A1",
                  ambiente: "PRODUCTION",
                  plan_suscripcion: "STARTER",
                  activo: true,
                  custom_metadata: {},
                },
                {
                  id: "empresa-02",
                  nombre_comercial: "Pirelli Master Service",
                  rfc: "PMS2001019B2",
                  ambiente: "PRODUCTION",
                  plan_suscripcion: "PRO",
                  activo: true,
                  custom_metadata: {},
                },
                {
                  id: "empresa-03",
                  nombre_comercial: "Red Flotillas Monterrey",
                  rfc: "RFM1902038C3",
                  ambiente: "PRODUCTION",
                  plan_suscripcion: "ENTERPRISE",
                  activo: false, // suspendida para test
                  custom_metadata: {},
                },
              ],
              error: null,
            }),
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "empresa-01",
                  nombre_comercial: "Torque & Ruta",
                  custom_metadata: {},
                },
                error: null,
              }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "empresa-01",
                  nombre_comercial: "Torque & Ruta",
                  plan_suscripcion: "STARTER",
                  activo: true,
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "empresa-new-01",
                  nombre_comercial: "Nuevo Taller Express",
                  ambiente: "SANDBOX",
                  plan_suscripcion: "STARTER",
                  activo: true,
                  created_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "sucursales") {
        const sucData = [
          { id: "suc-1", empresa_id: "empresa-01", activa: true },
          { id: "suc-2", empresa_id: "empresa-02", activa: true },
          { id: "suc-3", empresa_id: "empresa-02", activa: true },
        ];
        const selectObj = Promise.resolve({ data: sucData, error: null }) as any;
        selectObj.order = vi.fn().mockResolvedValue({ data: sucData, error: null });
        return {
          select: vi.fn().mockReturnValue(selectObj),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "ordenes_servicio") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { id: "ord-1", empresa_id: "empresa-01" },
              { id: "ord-2", empresa_id: "empresa-01" },
              { id: "ord-3", empresa_id: "empresa-02" },
            ],
          }),
        };
      }

      if (table === "vehiculos") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { id: "veh-1", empresa_id: "empresa-01" },
              { id: "veh-2", empresa_id: "empresa-02" },
            ],
          }),
        };
      }

      if (table === "perfiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "usr-superadmin-01",
                  nombre: "SuperAdmin AutoListo",
                  rol: "SuperAdmin",
                  empresa_id: "empresa-01",
                },
              }),
            }),
          }),
        };
      }

      if (table === "superadmin_audit_logs") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "log-1",
                    accion: "IMPERSONATION_START",
                    detalles: { target_name: "Torque & Ruta" },
                    created_at: new Date().toISOString(),
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "tenant_domains") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "dom-1",
                    domain: "taller.torqueyruta.mx",
                    empresa_id: "empresa-01",
                    verified: true,
                    is_primary: true,
                    custom_theme: {
                      app_title: "Torque & Ruta Taller",
                      primary_color: "#2563EB",
                      sidebar_color: "#0F172A",
                    },
                    empresa: {
                      id: "empresa-01",
                      nombre_comercial: "Torque & Ruta",
                      logo_url: null,
                    },
                  },
                  error: null,
                }),
              }),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "dom-1",
                    domain: "taller.torqueyruta.mx",
                    empresa_id: "empresa-01",
                    is_primary: true,
                    verified: true,
                  },
                ],
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "dom-new",
                  domain: "cova.autolisto.mx",
                  empresa_id: "empresa-01",
                  verified: true,
                  is_primary: true,
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      };
    }),
  }),
}));

describe("🛡️ AutoListo HQ & Infraestructura Multi-Tenant (Transplantada de Cargatek)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("HQ-01: Calcula métricas SaaS, sucursales y cuotas por plan de suscripción", async () => {
    const list = await saasHqService.getEmpresasWithMetrics();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(3);

    const starter = list.find((e) => e.plan_suscripcion === "STARTER");
    expect(starter).toBeDefined();
    expect(starter?.sucursales_limite).toBe(1);
    expect(starter?.sucursales_activas).toBe(1);

    const pro = list.find((e) => e.plan_suscripcion === "PRO");
    expect(pro).toBeDefined();
    expect(pro?.sucursales_limite).toBe(3);
    expect(pro?.sucursales_activas).toBe(2);

    const enterprise = list.find((e) => e.plan_suscripcion === "ENTERPRISE");
    expect(enterprise).toBeDefined();
    expect(enterprise?.sucursales_limite).toBeGreaterThan(1000); // virtualmente ilimitadas
    expect(enterprise?.activo).toBe(false);
  });

  it("HQ-02: Kill-Switch - Permite suspender y reactivar talleres con bitácora de auditoría", async () => {
    const okSuspension = await saasHqService.toggleEmpresaActivo(
      "empresa-01",
      false,
      "Falta de pago de mensualidad SaaS"
    );
    expect(okSuspension).toBe(true);

    const logs = await saasHqService.getAuditLogs(10);
    expect(logs.length).toBeGreaterThan(0);
    const suspensionLog = logs.find((l) => l.accion === "TENANT_SUSPENDED");
    expect(suspensionLog).toBeDefined();
    expect(suspensionLog?.detalles?.motivo).toContain("Falta de pago");

    const okReactivacion = await saasHqService.toggleEmpresaActivo(
      "empresa-01",
      true,
      "Pago acreditado vía SPEI"
    );
    expect(okReactivacion).toBe(true);
  });

  it("HQ-03: Conciliación Manual de Pago - Extiende vigencia, actualiza plan y reactiva cuenta", async () => {
    const res = await saasHqService.registrarPagoConciliacion({
      empresaId: "empresa-03",
      plan_suscripcion: "ENTERPRISE",
      mesesVigencia: 12,
      monto: 99990,
      referencia: "SPEI-BBVA-782193",
      metodoPago: "TRANSFERENCIA_SPEI",
      notas: "Pago anual con descuento",
    });

    expect(res).toBe(true);

    const logs = await saasHqService.getAuditLogs(10);
    const payLog = logs.find((l) => l.accion === "SUBSCRIPTION_PAYMENT_RECONCILED");
    expect(payLog).toBeDefined();
    expect(payLog?.detalles?.monto).toBe(99990);
    expect(payLog?.detalles?.meses_agregados).toBe(12);
  });

  it("HQ-04: Motor de Impersonación - Inicia modo soporte y restaura sesión al finalizar", async () => {
    // 1. Iniciar impersonación
    const impSession = await saasHqService.iniciarImpersonacion("empresa-02", "Pirelli Master Service");
    expect(impSession.isImpersonating).toBe(true);
    expect(impSession.targetEmpresaId).toBe("empresa-02");
    expect(impSession.targetEmpresaNombre).toBe("Pirelli Master Service");

    // Verificar lectura en runtime
    const current = saasHqService.getImpersonationStatus();
    expect(current).not.toBeNull();
    expect(current?.targetEmpresaId).toBe("empresa-02");

    // 2. Finalizar impersonación
    await saasHqService.finalizarImpersonacion();
    expect(saasHqService.getImpersonationStatus()).toBeNull();
  });

  it("HQ-05: White-Label - Resolución de dominios personalizados y marca blanca", async () => {
    const domainInfo = await tenantDomainService.resolverTenantPorDominio("taller.torqueyruta.mx");
    expect(domainInfo).not.toBeNull();
    expect(domainInfo?.domain).toBe("taller.torqueyruta.mx");
    expect(domainInfo?.custom_theme?.app_title).toBe("Torque & Ruta Taller");
    expect(domainInfo?.custom_theme?.primary_color).toBe("#2563EB");

    // Registro de nuevo dominio
    const nuevo = await tenantDomainService.registrarDominio(
      "empresa-01",
      "cova.autolisto.mx",
      true,
      { app_title: "Cova Performance" }
    );
    expect(nuevo).toBeDefined();
    expect(nuevo.domain).toBe("cova.autolisto.mx");
  });
});
