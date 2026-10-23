export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      caja_arqueos_denominaciones: {
        Row: {
          b100: number
          b1000: number
          b20: number
          b200: number
          b50: number
          b500: number
          centavos: number
          created_at: string
          fondo_id: string
          id: string
          m1: number
          m10: number
          m2: number
          m20: number
          m5: number
          total_calculado: number
          turno_id: string
        }
        Insert: {
          b100?: number
          b1000?: number
          b20?: number
          b200?: number
          b50?: number
          b500?: number
          centavos?: number
          created_at?: string
          fondo_id: string
          id?: string
          m1?: number
          m10?: number
          m2?: number
          m20?: number
          m5?: number
          total_calculado?: number
          turno_id: string
        }
        Update: {
          b100?: number
          b1000?: number
          b20?: number
          b200?: number
          b50?: number
          b500?: number
          centavos?: number
          created_at?: string
          fondo_id?: string
          id?: string
          m1?: number
          m10?: number
          m2?: number
          m20?: number
          m5?: number
          total_calculado?: number
          turno_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caja_arqueos_denominaciones_fondo_id_fkey"
            columns: ["fondo_id"]
            isOneToOne: false
            referencedRelation: "caja_fondos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_arqueos_denominaciones_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "caja_turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_fondos: {
        Row: {
          activo: boolean
          created_at: string
          empresa_id: string
          id: string
          nombre: string
          saldo_actual: number
          saldo_minimo_alerta: number | null
          sucursal_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nombre: string
          saldo_actual?: number
          saldo_minimo_alerta?: number | null
          sucursal_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nombre?: string
          saldo_actual?: number
          saldo_minimo_alerta?: number | null
          sucursal_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caja_fondos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_fondos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_movimientos: {
        Row: {
          caja_fondo_id: string | null
          caja_turno_id: string | null
          concepto: string
          created_at: string
          empresa_id: string
          id: string
          idempotency_key: string | null
          metodo: string | null
          monto: number
          responsable: string | null
          sucursal_id: string | null
          tipo: string
        }
        Insert: {
          caja_fondo_id?: string | null
          caja_turno_id?: string | null
          concepto: string
          created_at?: string
          empresa_id?: string
          id?: string
          idempotency_key?: string | null
          metodo?: string | null
          monto: number
          responsable?: string | null
          sucursal_id?: string | null
          tipo: string
        }
        Update: {
          caja_fondo_id?: string | null
          caja_turno_id?: string | null
          concepto?: string
          created_at?: string
          empresa_id?: string
          id?: string
          idempotency_key?: string | null
          metodo?: string | null
          monto?: number
          responsable?: string | null
          sucursal_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "caja_movimientos_caja_fondo_id_fkey"
            columns: ["caja_fondo_id"]
            isOneToOne: false
            referencedRelation: "caja_fondos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_caja_turno_id_fkey"
            columns: ["caja_turno_id"]
            isOneToOne: false
            referencedRelation: "caja_turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_traspasos_fondos: {
        Row: {
          concepto: string
          created_at: string
          empresa_id: string
          fondo_destino_id: string
          fondo_origen_id: string
          id: string
          monto: number
          sucursal_id: string | null
          turno_id: string | null
          usuario_id: string | null
        }
        Insert: {
          concepto: string
          created_at?: string
          empresa_id: string
          fondo_destino_id: string
          fondo_origen_id: string
          id?: string
          monto: number
          sucursal_id?: string | null
          turno_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          concepto?: string
          created_at?: string
          empresa_id?: string
          fondo_destino_id?: string
          fondo_origen_id?: string
          id?: string
          monto?: number
          sucursal_id?: string | null
          turno_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caja_traspasos_fondos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_traspasos_fondos_fondo_destino_id_fkey"
            columns: ["fondo_destino_id"]
            isOneToOne: false
            referencedRelation: "caja_fondos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_traspasos_fondos_fondo_origen_id_fkey"
            columns: ["fondo_origen_id"]
            isOneToOne: false
            referencedRelation: "caja_fondos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_traspasos_fondos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_traspasos_fondos_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "caja_turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_traspasos_fondos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_turnos: {
        Row: {
          created_at: string
          diferencia_f1: number | null
          diferencia_f2: number | null
          empresa_id: string
          estado: string
          fecha_apertura: string
          fecha_cierre: string | null
          id: string
          justificacion_descuadre: string | null
          monto_apertura_fondo1: number
          monto_apertura_fondo2: number
          monto_cierre_declarado_f1: number | null
          monto_cierre_declarado_f2: number | null
          monto_cierre_teorico_f1: number | null
          monto_cierre_teorico_f2: number | null
          monto_fondo_siguiente_f1: number | null
          monto_remesa_retirada: number | null
          snapshot_resumen: Json | null
          sucursal_id: string | null
          usuario_apertura_id: string | null
          usuario_cierre_id: string | null
        }
        Insert: {
          created_at?: string
          diferencia_f1?: number | null
          diferencia_f2?: number | null
          empresa_id: string
          estado?: string
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          justificacion_descuadre?: string | null
          monto_apertura_fondo1?: number
          monto_apertura_fondo2?: number
          monto_cierre_declarado_f1?: number | null
          monto_cierre_declarado_f2?: number | null
          monto_cierre_teorico_f1?: number | null
          monto_cierre_teorico_f2?: number | null
          monto_fondo_siguiente_f1?: number | null
          monto_remesa_retirada?: number | null
          snapshot_resumen?: Json | null
          sucursal_id?: string | null
          usuario_apertura_id?: string | null
          usuario_cierre_id?: string | null
        }
        Update: {
          created_at?: string
          diferencia_f1?: number | null
          diferencia_f2?: number | null
          empresa_id?: string
          estado?: string
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          justificacion_descuadre?: string | null
          monto_apertura_fondo1?: number
          monto_apertura_fondo2?: number
          monto_cierre_declarado_f1?: number | null
          monto_cierre_declarado_f2?: number | null
          monto_cierre_teorico_f1?: number | null
          monto_cierre_teorico_f2?: number | null
          monto_fondo_siguiente_f1?: number | null
          monto_remesa_retirada?: number | null
          snapshot_resumen?: Json | null
          sucursal_id?: string | null
          usuario_apertura_id?: string | null
          usuario_cierre_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caja_turnos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_turnos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_turnos_usuario_apertura_id_fkey"
            columns: ["usuario_apertura_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_turnos_usuario_cierre_id_fkey"
            columns: ["usuario_cierre_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_danos: {
        Row: {
          id: string
          orden_servicio_id: string
          tipo_dano: string
          url_foto: string | null
          zona_vehiculo: string
        }
        Insert: {
          id?: string
          orden_servicio_id: string
          tipo_dano: string
          url_foto?: string | null
          zona_vehiculo: string
        }
        Update: {
          id?: string
          orden_servicio_id?: string
          tipo_dano?: string
          url_foto?: string | null
          zona_vehiculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_danos_orden_servicio_id_fkey"
            columns: ["orden_servicio_id"]
            isOneToOne: false
            referencedRelation: "ordenes_servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      citas: {
        Row: {
          cliente_id: string | null
          creado_en: string
          estado: string
          fecha_cita: string
          id: string
          motivo: string
        }
        Insert: {
          cliente_id?: string | null
          creado_en?: string
          estado?: string
          fecha_cita: string
          id?: string
          motivo: string
        }
        Update: {
          cliente_id?: string | null
          creado_en?: string
          estado?: string
          fecha_cita?: string
          id?: string
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "citas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          correo: string | null
          empresa: string | null
          empresa_id: string
          fecha_registro: string
          fuente_adquisicion: string | null
          id: string
          nombre: string
          notas_internas: string | null
          rfc: string | null
          tags: string[] | null
          telefono: string | null
        }
        Insert: {
          correo?: string | null
          empresa?: string | null
          empresa_id?: string
          fecha_registro?: string
          fuente_adquisicion?: string | null
          id?: string
          nombre: string
          notas_internas?: string | null
          rfc?: string | null
          tags?: string[] | null
          telefono?: string | null
        }
        Update: {
          correo?: string | null
          empresa?: string | null
          empresa_id?: string
          fecha_registro?: string
          fuente_adquisicion?: string | null
          id?: string
          nombre?: string
          notas_internas?: string | null
          rfc?: string | null
          tags?: string[] | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cola_notificaciones: {
        Row: {
          estado: string
          fecha_creacion: string
          fecha_envio: string | null
          id: string
          mensaje: string
          telefono: string
        }
        Insert: {
          estado?: string
          fecha_creacion?: string
          fecha_envio?: string | null
          id?: string
          mensaje: string
          telefono: string
        }
        Update: {
          estado?: string
          fecha_creacion?: string
          fecha_envio?: string | null
          id?: string
          mensaje?: string
          telefono?: string
        }
        Relationships: []
      }
      configuracion_pagos: {
        Row: {
          activo: boolean
          comision_porcentaje: number
          created_at: string
          empresa_id: string
          id: string
          proveedor: string
        }
        Insert: {
          activo?: boolean
          comision_porcentaje?: number
          created_at?: string
          empresa_id?: string
          id?: string
          proveedor: string
        }
        Update: {
          activo?: boolean
          comision_porcentaje?: number
          created_at?: string
          empresa_id?: string
          id?: string
          proveedor?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_pagos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          cliente_id: string | null
          creado_en: string
          estado: string
          id: string
          plataforma: string
        }
        Insert: {
          cliente_id?: string | null
          creado_en?: string
          estado?: string
          id?: string
          plataforma: string
        }
        Update: {
          cliente_id?: string | null
          creado_en?: string
          estado?: string
          id?: string
          plataforma?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones_omnicanal: {
        Row: {
          canal: string
          cliente_id: string | null
          creado_en: string
          empresa_id: string
          estado: string
          id: string
          identificador_externo: string
          ultimo_mensaje_at: string
        }
        Insert: {
          canal: string
          cliente_id?: string | null
          creado_en?: string
          empresa_id?: string
          estado?: string
          id?: string
          identificador_externo: string
          ultimo_mensaje_at?: string
        }
        Update: {
          canal?: string
          cliente_id?: string | null
          creado_en?: string
          empresa_id?: string
          estado?: string
          id?: string
          identificador_externo?: string
          ultimo_mensaje_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_omnicanal_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_omnicanal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          caja_turno_id: string | null
          cliente_id: string
          cuenta_bancaria_id: string | null
          empresa_id: string
          estatus: string
          fecha: string
          id: string
          metodos_pago: Json | null
          recordatorio_enviado: boolean
          sucursal_id: string | null
          total: number
          vehiculo_id: string
          vendedor_id: string | null
        }
        Insert: {
          caja_turno_id?: string | null
          cliente_id: string
          cuenta_bancaria_id?: string | null
          empresa_id?: string
          estatus?: string
          fecha?: string
          id?: string
          metodos_pago?: Json | null
          recordatorio_enviado?: boolean
          sucursal_id?: string | null
          total?: number
          vehiculo_id: string
          vendedor_id?: string | null
        }
        Update: {
          caja_turno_id?: string | null
          cliente_id?: string
          cuenta_bancaria_id?: string | null
          empresa_id?: string
          estatus?: string
          fecha?: string
          id?: string
          metodos_pago?: Json | null
          recordatorio_enviado?: boolean
          sucursal_id?: string | null
          total?: number
          vehiculo_id?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_caja_turno_id_fkey"
            columns: ["caja_turno_id"]
            isOneToOne: false
            referencedRelation: "caja_turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas_bancarias: {
        Row: {
          activo: boolean
          alias: string
          banco: string
          clabe: string | null
          created_at: string
          empresa_id: string
          id: string
          numero_cuenta: string | null
          sucursal_id: string | null
          titular: string | null
        }
        Insert: {
          activo?: boolean
          alias: string
          banco: string
          clabe?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          numero_cuenta?: string | null
          sucursal_id?: string | null
          titular?: string | null
        }
        Update: {
          activo?: boolean
          alias?: string
          banco?: string
          clabe?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          numero_cuenta?: string | null
          sucursal_id?: string | null
          titular?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuentas_bancarias_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      detalles_cotizacion: {
        Row: {
          cantidad: number
          cotizacion_id: string
          empresa_id: string
          estatus_aprobacion: string | null
          id: string
          llanta_id: string
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          cotizacion_id: string
          empresa_id?: string
          estatus_aprobacion?: string | null
          id?: string
          llanta_id: string
          precio_unitario: number
          subtotal: number
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          empresa_id?: string
          estatus_aprobacion?: string | null
          id?: string
          llanta_id?: string
          precio_unitario?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "detalles_cotizacion_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalles_cotizacion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalles_cotizacion_llanta_id_fkey"
            columns: ["llanta_id"]
            isOneToOne: false
            referencedRelation: "inventario_llantas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalles_cotizacion_llanta_id_fkey"
            columns: ["llanta_id"]
            isOneToOne: false
            referencedRelation: "inventario_llantas_base"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean
          color_avatar: string | null
          comision_porcentaje: number | null
          empresa_id: string
          especialidad: string | null
          id: string
          nombre: string
          puesto: string | null
          rol: string
          sucursal_id: string | null
          tarifa_hora: number | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          color_avatar?: string | null
          comision_porcentaje?: number | null
          empresa_id?: string
          especialidad?: string | null
          id?: string
          nombre: string
          puesto?: string | null
          rol: string
          sucursal_id?: string | null
          tarifa_hora?: number | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          color_avatar?: string | null
          comision_porcentaje?: number | null
          empresa_id?: string
          especialidad?: string | null
          id?: string
          nombre?: string
          puesto?: string | null
          rol?: string
          sucursal_id?: string | null
          tarifa_hora?: number | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empleados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          activo: boolean | null
          ambiente: string | null
          color_primario: string | null
          color_sidebar: string | null
          created_at: string
          custom_metadata: Json | null
          direccion: string | null
          email_contacto: string | null
          eslogan: string | null
          id: string
          logo_url: string | null
          margen_refacciones_default: number | null
          nombre_comercial: string
          plan_suscripcion: string | null
          rfc: string | null
          sitio_web: string | null
          tasa_iva: number | null
          telefono: string | null
          terminos_condiciones: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          ambiente?: string | null
          color_primario?: string | null
          color_sidebar?: string | null
          created_at?: string
          custom_metadata?: Json | null
          direccion?: string | null
          email_contacto?: string | null
          eslogan?: string | null
          id?: string
          logo_url?: string | null
          margen_refacciones_default?: number | null
          nombre_comercial: string
          plan_suscripcion?: string | null
          rfc?: string | null
          sitio_web?: string | null
          tasa_iva?: number | null
          telefono?: string | null
          terminos_condiciones?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          ambiente?: string | null
          color_primario?: string | null
          color_sidebar?: string | null
          created_at?: string
          custom_metadata?: Json | null
          direccion?: string | null
          email_contacto?: string | null
          eslogan?: string | null
          id?: string
          logo_url?: string | null
          margen_refacciones_default?: number | null
          nombre_comercial?: string
          plan_suscripcion?: string | null
          rfc?: string | null
          sitio_web?: string | null
          tasa_iva?: number | null
          telefono?: string | null
          terminos_condiciones?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      historial_servicios: {
        Row: {
          costo: number
          descripcion: string
          fecha: string
          id: string
          vehiculo_id: string
        }
        Insert: {
          costo?: number
          descripcion: string
          fecha?: string
          id?: string
          vehiculo_id: string
        }
        Update: {
          costo?: number
          descripcion?: string
          fecha?: string
          id?: string
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_servicios_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      inspecciones_dvi: {
        Row: {
          categoria: string
          costo_estimado: number | null
          created_at: string
          empresa_id: string
          estatus_cliente: string | null
          foto_url: string | null
          id: string
          observaciones: string | null
          orden_servicio_id: string
          punto_inspeccion: string
          recomendacion: string | null
          severidad: string
        }
        Insert: {
          categoria: string
          costo_estimado?: number | null
          created_at?: string
          empresa_id?: string
          estatus_cliente?: string | null
          foto_url?: string | null
          id?: string
          observaciones?: string | null
          orden_servicio_id: string
          punto_inspeccion: string
          recomendacion?: string | null
          severidad?: string
        }
        Update: {
          categoria?: string
          costo_estimado?: number | null
          created_at?: string
          empresa_id?: string
          estatus_cliente?: string | null
          foto_url?: string | null
          id?: string
          observaciones?: string | null
          orden_servicio_id?: string
          punto_inspeccion?: string
          recomendacion?: string | null
          severidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspecciones_dvi_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspecciones_dvi_orden_servicio_id_fkey"
            columns: ["orden_servicio_id"]
            isOneToOne: false
            referencedRelation: "ordenes_servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_llantas_base: {
        Row: {
          ancho: number
          costo_adquisicion: number
          dot_anio: string | null
          empresa_id: string
          id: string
          indice_carga_velocidad: string
          marca: string
          modelo_llanta: string
          perfil: number
          precio_venta: number
          rin: number
          stock_actual: number
          stock_minimo: number
          sucursal_id: string | null
          tipo_terreno: string
          ubicacion_rack: string | null
        }
        Insert: {
          ancho: number
          costo_adquisicion?: number
          dot_anio?: string | null
          empresa_id?: string
          id?: string
          indice_carga_velocidad: string
          marca: string
          modelo_llanta: string
          perfil: number
          precio_venta?: number
          rin: number
          stock_actual?: number
          stock_minimo?: number
          sucursal_id?: string | null
          tipo_terreno: string
          ubicacion_rack?: string | null
        }
        Update: {
          ancho?: number
          costo_adquisicion?: number
          dot_anio?: string | null
          empresa_id?: string
          id?: string
          indice_carga_velocidad?: string
          marca?: string
          modelo_llanta?: string
          perfil?: number
          precio_venta?: number
          rin?: number
          stock_actual?: number
          stock_minimo?: number
          sucursal_id?: string | null
          tipo_terreno?: string
          ubicacion_rack?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventario_llantas_base_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_llantas_base_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes_crm: {
        Row: {
          contenido: string
          conversacion_id: string | null
          creado_en: string
          id: string
          sender_type: string
        }
        Insert: {
          contenido: string
          conversacion_id?: string | null
          creado_en?: string
          id?: string
          sender_type: string
        }
        Update: {
          contenido?: string
          conversacion_id?: string | null
          creado_en?: string
          id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_crm_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes_omnicanal: {
        Row: {
          contenido: string
          conversacion_id: string
          creado_en: string
          empresa_id: string
          id: string
          metadatos: Json | null
          sentido: string
          tipo: string
        }
        Insert: {
          contenido: string
          conversacion_id: string
          creado_en?: string
          empresa_id?: string
          id?: string
          metadatos?: Json | null
          sentido: string
          tipo?: string
        }
        Update: {
          contenido?: string
          conversacion_id?: string
          creado_en?: string
          empresa_id?: string
          id?: string
          metadatos?: Json | null
          sentido?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_omnicanal_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones_omnicanal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_omnicanal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidades_venta: {
        Row: {
          cliente_id: string | null
          creado_en: string
          estado: string
          id: string
          monto_estimado: number | null
        }
        Insert: {
          cliente_id?: string | null
          creado_en?: string
          estado?: string
          id?: string
          monto_estimado?: number | null
        }
        Update: {
          cliente_id?: string | null
          creado_en?: string
          estado?: string
          id?: string
          monto_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_venta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_servicio_refacciones: {
        Row: {
          cantidad: number
          costo_unitario: number
          created_at: string
          empresa_id: string
          estatus_aprobacion: string | null
          id: string
          margen_porcentaje: number
          nombre: string
          numero_parte: string | null
          orden_servicio_id: string
          precio_unitario: number
          proveedor: string | null
          subtotal: number
        }
        Insert: {
          cantidad?: number
          costo_unitario?: number
          created_at?: string
          empresa_id?: string
          estatus_aprobacion?: string | null
          id?: string
          margen_porcentaje?: number
          nombre: string
          numero_parte?: string | null
          orden_servicio_id: string
          precio_unitario?: number
          proveedor?: string | null
          subtotal?: number
        }
        Update: {
          cantidad?: number
          costo_unitario?: number
          created_at?: string
          empresa_id?: string
          estatus_aprobacion?: string | null
          id?: string
          margen_porcentaje?: number
          nombre?: string
          numero_parte?: string | null
          orden_servicio_id?: string
          precio_unitario?: number
          proveedor?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "orden_servicio_refacciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_servicio_refacciones_orden_servicio_id_fkey"
            columns: ["orden_servicio_id"]
            isOneToOne: false
            referencedRelation: "ordenes_servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_servicio_servicios: {
        Row: {
          cantidad: number | null
          comision_porcentaje: number | null
          created_at: string | null
          empresa_id: string
          estatus_aprobacion: string | null
          horas_labor: number | null
          id: string
          mecanico_id: string | null
          notas: string | null
          orden_servicio_id: string
          precio_cobrado: number
          servicio_id: string
        }
        Insert: {
          cantidad?: number | null
          comision_porcentaje?: number | null
          created_at?: string | null
          empresa_id?: string
          estatus_aprobacion?: string | null
          horas_labor?: number | null
          id?: string
          mecanico_id?: string | null
          notas?: string | null
          orden_servicio_id: string
          precio_cobrado: number
          servicio_id: string
        }
        Update: {
          cantidad?: number | null
          comision_porcentaje?: number | null
          created_at?: string | null
          empresa_id?: string
          estatus_aprobacion?: string | null
          horas_labor?: number | null
          id?: string
          mecanico_id?: string | null
          notas?: string | null
          orden_servicio_id?: string
          precio_cobrado?: number
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orden_servicio_servicios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_servicio_servicios_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_servicio_servicios_orden_servicio_id_fkey"
            columns: ["orden_servicio_id"]
            isOneToOne: false
            referencedRelation: "ordenes_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_servicio_servicios_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios_taller"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_servicio: {
        Row: {
          aprobado_cliente_at: string | null
          aprobado_cliente_nombre: string | null
          asesor_id: string | null
          bahia_rampa: string | null
          checklist_recepcion: Json | null
          cotizacion_id: string | null
          diagnostico_tecnico: string | null
          empresa_id: string
          estado: string
          estatus_pago: string
          fecha_ingreso: string
          fecha_promesa: string | null
          folio: number
          id: string
          kilometraje_ingreso: number
          mecanico_id: string | null
          nivel_gasolina: string
          notas_recepcion: string | null
          prioridad: string | null
          problema_reportado: string | null
          sub_estado: string | null
          sucursal_id: string | null
          tags: string[] | null
          updated_at: string | null
          vehiculo_id: string
          version: number
        }
        Insert: {
          aprobado_cliente_at?: string | null
          aprobado_cliente_nombre?: string | null
          asesor_id?: string | null
          bahia_rampa?: string | null
          checklist_recepcion?: Json | null
          cotizacion_id?: string | null
          diagnostico_tecnico?: string | null
          empresa_id?: string
          estado?: string
          estatus_pago?: string
          fecha_ingreso?: string
          fecha_promesa?: string | null
          folio?: number
          id?: string
          kilometraje_ingreso: number
          mecanico_id?: string | null
          nivel_gasolina: string
          notas_recepcion?: string | null
          prioridad?: string | null
          problema_reportado?: string | null
          sub_estado?: string | null
          sucursal_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          vehiculo_id: string
          version?: number
        }
        Update: {
          aprobado_cliente_at?: string | null
          aprobado_cliente_nombre?: string | null
          asesor_id?: string | null
          bahia_rampa?: string | null
          checklist_recepcion?: Json | null
          cotizacion_id?: string | null
          diagnostico_tecnico?: string | null
          empresa_id?: string
          estado?: string
          estatus_pago?: string
          fecha_ingreso?: string
          fecha_promesa?: string | null
          folio?: number
          id?: string
          kilometraje_ingreso?: number
          mecanico_id?: string | null
          nivel_gasolina?: string
          notas_recepcion?: string | null
          prioridad?: string | null
          problema_reportado?: string | null
          sub_estado?: string | null
          sucursal_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          vehiculo_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_servicio_asesor_id_fkey"
            columns: ["asesor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_servicio_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_servicio_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_servicio_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_servicio_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_servicio_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_orden: {
        Row: {
          caja_fondo_id: string | null
          caja_turno_id: string | null
          comision_pasarela: number | null
          cotizacion_id: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          empresa_id: string
          estatus: string
          external_transaction_id: string | null
          fecha_pago: string
          id: string
          metodo_detalle: string | null
          monto_total: number
          motivo_cancelacion: string | null
          orden_servicio_id: string | null
          proveedor_pago: string
          referencia: string | null
          sucursal_id: string | null
        }
        Insert: {
          caja_fondo_id?: string | null
          caja_turno_id?: string | null
          comision_pasarela?: number | null
          cotizacion_id?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          empresa_id?: string
          estatus?: string
          external_transaction_id?: string | null
          fecha_pago?: string
          id?: string
          metodo_detalle?: string | null
          monto_total: number
          motivo_cancelacion?: string | null
          orden_servicio_id?: string | null
          proveedor_pago: string
          referencia?: string | null
          sucursal_id?: string | null
        }
        Update: {
          caja_fondo_id?: string | null
          caja_turno_id?: string | null
          comision_pasarela?: number | null
          cotizacion_id?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          empresa_id?: string
          estatus?: string
          external_transaction_id?: string | null
          fecha_pago?: string
          id?: string
          metodo_detalle?: string | null
          monto_total?: number
          motivo_cancelacion?: string | null
          orden_servicio_id?: string | null
          proveedor_pago?: string
          referencia?: string | null
          sucursal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_orden_caja_fondo_id_fkey"
            columns: ["caja_fondo_id"]
            isOneToOne: false
            referencedRelation: "caja_fondos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_orden_caja_turno_id_fkey"
            columns: ["caja_turno_id"]
            isOneToOne: false
            referencedRelation: "caja_turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_orden_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_orden_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_orden_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_orden_orden_servicio_id_fkey"
            columns: ["orden_servicio_id"]
            isOneToOne: false
            referencedRelation: "ordenes_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_orden_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          empresa_id: string
          id: string
          nombre: string | null
          rol: string | null
          sucursal_id: string | null
          telefono: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          empresa_id: string
          id: string
          nombre?: string | null
          rol?: string | null
          sucursal_id?: string | null
          telefono?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nombre?: string | null
          rol?: string | null
          sucursal_id?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_notificacion: {
        Row: {
          contenido: string
          empresa_id: string
          id: string
          nombre: string
        }
        Insert: {
          contenido: string
          empresa_id?: string
          id: string
          nombre: string
        }
        Update: {
          contenido?: string
          empresa_id?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_notificacion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      reglas_automatizacion: {
        Row: {
          activa: boolean
          empresa_id: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          empresa_id?: string
          id: string
          nombre: string
        }
        Update: {
          activa?: boolean
          empresa_id?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "reglas_automatizacion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios_taller: {
        Row: {
          activo: boolean | null
          aplica_promo_llantas: boolean | null
          categoria: string | null
          codigo_sku: string | null
          created_at: string | null
          descripcion: string | null
          empresa_id: string
          horas_estimadas: number | null
          id: string
          nombre: string
          precio: number
        }
        Insert: {
          activo?: boolean | null
          aplica_promo_llantas?: boolean | null
          categoria?: string | null
          codigo_sku?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          horas_estimadas?: number | null
          id?: string
          nombre: string
          precio?: number
        }
        Update: {
          activo?: boolean | null
          aplica_promo_llantas?: boolean | null
          categoria?: string | null
          codigo_sku?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          horas_estimadas?: number | null
          id?: string
          nombre?: string
          precio?: number
        }
        Relationships: [
          {
            foreignKeyName: "servicios_taller_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursales: {
        Row: {
          activa: boolean | null
          codigo: string | null
          created_at: string
          direccion: string | null
          empresa_id: string
          es_matriz: boolean | null
          gerente: string | null
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          activa?: boolean | null
          codigo?: string | null
          created_at?: string
          direccion?: string | null
          empresa_id?: string
          es_matriz?: boolean | null
          gerente?: string | null
          id?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          activa?: boolean | null
          codigo?: string | null
          created_at?: string
          direccion?: string | null
          empresa_id?: string
          es_matriz?: boolean | null
          gerente?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucursales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      superadmin_audit_logs: {
        Row: {
          accion: string
          created_at: string | null
          detalles: Json | null
          id: string
          ip_address: string | null
          superadmin_id: string | null
          target_empresa_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string | null
          detalles?: Json | null
          id?: string
          ip_address?: string | null
          superadmin_id?: string | null
          target_empresa_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string | null
          detalles?: Json | null
          id?: string
          ip_address?: string | null
          superadmin_id?: string | null
          target_empresa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "superadmin_audit_logs_target_empresa_id_fkey"
            columns: ["target_empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          created_at: string | null
          custom_theme: Json | null
          domain: string
          empresa_id: string
          id: string
          is_primary: boolean | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          custom_theme?: Json | null
          domain: string
          empresa_id: string
          id?: string
          is_primary?: boolean | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          custom_theme?: Json | null
          domain?: string
          empresa_id?: string
          id?: string
          is_primary?: boolean | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      trabajos_diferidos: {
        Row: {
          categoria: string | null
          cliente_id: string
          concepto: string
          costo_estimado: number | null
          created_at: string
          empresa_id: string
          fecha_recordatorio: string | null
          id: string
          notas: string | null
          orden_origen_id: string | null
          resuelto: boolean | null
          severidad: string | null
          vehiculo_id: string
        }
        Insert: {
          categoria?: string | null
          cliente_id: string
          concepto: string
          costo_estimado?: number | null
          created_at?: string
          empresa_id?: string
          fecha_recordatorio?: string | null
          id?: string
          notas?: string | null
          orden_origen_id?: string | null
          resuelto?: boolean | null
          severidad?: string | null
          vehiculo_id: string
        }
        Update: {
          categoria?: string | null
          cliente_id?: string
          concepto?: string
          costo_estimado?: number | null
          created_at?: string
          empresa_id?: string
          fecha_recordatorio?: string | null
          id?: string
          notas?: string | null
          orden_origen_id?: string | null
          resuelto?: boolean | null
          severidad?: string | null
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trabajos_diferidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabajos_diferidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabajos_diferidos_orden_origen_id_fkey"
            columns: ["orden_origen_id"]
            isOneToOne: false
            referencedRelation: "ordenes_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabajos_diferidos_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      vehiculos: {
        Row: {
          anio: number
          cliente_id: string
          color: string | null
          empresa_id: string
          id: string
          kilometraje: string | null
          kilometraje_actual: number
          marca: string
          medida_oem: string | null
          modelo: string
          placas: string | null
          presion_delantera_psi: number | null
          presion_trasera_psi: number | null
          vin: string | null
        }
        Insert: {
          anio: number
          cliente_id: string
          color?: string | null
          empresa_id?: string
          id?: string
          kilometraje?: string | null
          kilometraje_actual?: number
          marca: string
          medida_oem?: string | null
          modelo: string
          placas?: string | null
          presion_delantera_psi?: number | null
          presion_trasera_psi?: number | null
          vin?: string | null
        }
        Update: {
          anio?: number
          cliente_id?: string
          color?: string | null
          empresa_id?: string
          id?: string
          kilometraje?: string | null
          kilometraje_actual?: number
          marca?: string
          medida_oem?: string | null
          modelo?: string
          placas?: string | null
          presion_delantera_psi?: number | null
          presion_trasera_psi?: number | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehiculos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehiculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventario_llantas: {
        Row: {
          ancho: number | null
          costo_adquisicion: number | null
          empresa_id: string | null
          id: string | null
          indice_carga_velocidad: string | null
          marca: string | null
          modelo_llanta: string | null
          perfil: number | null
          precio_venta: number | null
          rin: number | null
          stock_actual: number | null
          stock_minimo: number | null
          tipo_terreno: string | null
        }
        Insert: {
          ancho?: number | null
          costo_adquisicion?: never
          empresa_id?: string | null
          id?: string | null
          indice_carga_velocidad?: string | null
          marca?: string | null
          modelo_llanta?: string | null
          perfil?: number | null
          precio_venta?: number | null
          rin?: number | null
          stock_actual?: number | null
          stock_minimo?: number | null
          tipo_terreno?: string | null
        }
        Update: {
          ancho?: number | null
          costo_adquisicion?: never
          empresa_id?: string | null
          id?: string | null
          indice_carga_velocidad?: string | null
          marca?: string | null
          modelo_llanta?: string | null
          perfil?: number | null
          precio_venta?: number | null
          rin?: number | null
          stock_actual?: number | null
          stock_minimo?: number | null
          tipo_terreno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventario_llantas_base_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      crear_empresa_y_perfil: {
        Args: { p_nombre_empresa: string; p_nombre_usuario: string }
        Returns: undefined
      }
      fn_abrir_turno_caja: {
        Args: {
          p_empresa_id: string
          p_monto_fondo1: number
          p_monto_fondo2: number
          p_sucursal_id: string
          p_usuario_id: string
        }
        Returns: Json
      }
      fn_actualizar_orden_concurrente: {
        Args: {
          p_expected_version: number
          p_orden_id: string
          p_payload: Json
        }
        Returns: Json
      }
      fn_ajustar_stock_llanta: {
        Args: {
          p_cantidad_delta: number
          p_llanta_id: string
          p_permitir_negativo?: boolean
        }
        Returns: Json
      }
      fn_cerrar_turno_caja: {
        Args: {
          p_declarado_f1: number
          p_declarado_f2: number
          p_denominaciones_f1: Json
          p_denominaciones_f2: Json
          p_justificacion: string
          p_monto_fondo_siguiente: number
          p_monto_remesa: number
          p_turno_id: string
          p_usuario_cierre_id: string
        }
        Returns: Json
      }
      fn_descontar_stock_orden: { Args: { p_items: Json }; Returns: Json }
      fn_registrar_movimiento_caja:
        | {
            Args: {
              p_concepto: string
              p_idempotency_key?: string
              p_metodo?: string
              p_monto: number
              p_responsable?: string
              p_sucursal_id?: string
              p_tipo: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_caja_fondo_id?: string
              p_caja_turno_id?: string
              p_concepto: string
              p_idempotency_key?: string
              p_metodo?: string
              p_monto: number
              p_responsable?: string
              p_sucursal_id?: string
              p_tipo: string
            }
            Returns: Json
          }
      fn_registrar_pagos_orden_multi: {
        Args: { p_orden_id: string; p_pagos: Json; p_sucursal_id?: string }
        Returns: Json
      }
      fn_registrar_venta_multi_pago:
        | {
            Args: {
              p_cliente_id: string
              p_items: Json
              p_pagos: Json
              p_servicios_adicionales?: Json
              p_sucursal_id?: string
              p_vehiculo_id: string
              p_vendedor_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_cliente_id: string
              p_items: Json
              p_pagos: Json
              p_servicios_adicionales?: Json
              p_sucursal_id: string
              p_vehiculo_id: string
              p_vendedor_id: string
            }
            Returns: Json
          }
      fn_traspaso_entre_fondos: {
        Args: {
          p_concepto: string
          p_fondo_destino_id: string
          p_fondo_origen_id: string
          p_monto: number
          p_turno_id: string
          p_usuario_id: string
        }
        Returns: Json
      }
      is_superadmin: { Args: never; Returns: boolean }
      obtener_orden_portal_publico: {
        Args: { p_orden_id: string }
        Returns: Json
      }
      procesar_aprobacion_portal_cliente: {
        Args: {
          p_llantas_diferidas: string[]
          p_nombre_firma: string
          p_orden_id: string
          p_refacciones_diferidas: string[]
          p_servicios_diferidos: string[]
        }
        Returns: Json
      }
      user_empresa_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
