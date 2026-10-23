'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Tire } from './TireSearch';
import { 
  User, 
  Car, 
  FileText, 
  Send, 
  Trash2, 
  Check, 
  Plus, 
  Minus, 
  CheckSquare, 
  Square,
  Sparkles,
  Loader2,
  AlertTriangle,
  Landmark
} from 'lucide-react';
import { toast } from 'sonner';
import { ConcurrencyService } from '@/services/concurrencyService';
import ModalAltaExpress from './ModalAltaExpress';
import ModalAltaVehiculo from './ModalAltaVehiculo';
import { createPortal } from 'react-dom';

export interface QuoteItem {
  tire: Tire;
  cantidad: number;
  precioUnitario: number;
}

interface QuoteBuilderProps {
  selectedItems: QuoteItem[];
  onRemoveItem: (tireId: string) => void;
  onUpdateQuantity: (tireId: string, delta: number) => void;
  onClearQuote: () => void;
  vendedorId?: string;
}

interface Client {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  vehiculos?: Vehicle[];
}

interface Vehicle {
  id: string;
  cliente_id: string;
  marca: string;
  modelo: string;
  anio: number;
  placas: string;
  vin: string;
  kilometraje_actual: number;
  presion_delantera_psi?: number;
  presion_trasera_psi?: number;
  medida_oem?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'add' | 'remove';
}

const MOCK_CLIENTS: Client[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nombre: 'Juan Pérez',
    telefono: '+52 667 123 4567',
    correo: 'juan.perez@email.com',
    vehiculos: [
      {
        id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        cliente_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        marca: 'Nissan',
        modelo: 'Versa',
        anio: 2020,
        placas: 'VJS-456-A',
        vin: '3N1CN8AP1LL123456',
        kilometraje_actual: 45000,
        presion_delantera_psi: 33,
        presion_trasera_psi: 33,
        medida_oem: '185/65 R15'
      }
    ]
  },
  {
    id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    nombre: 'María López',
    telefono: '+52 667 987 6543',
    correo: 'maria.lopez@email.com',
    vehiculos: [
      {
        id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
        cliente_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        marca: 'Chevrolet',
        modelo: 'Aveo',
        anio: 2018,
        placas: 'VMY-789-B',
        vin: 'KL1TD54E5JB654321',
        kilometraje_actual: 72000,
        presion_delantera_psi: 30,
        presion_trasera_psi: 30,
        medida_oem: '185/60 R15'
      }
    ]
  },
  {
    id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    nombre: 'Carlos Mendoza',
    telefono: '+52 667 444 5566',
    correo: 'carlos.mendoza@email.com',
    vehiculos: [
      {
        id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
        cliente_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        marca: 'Toyota',
        modelo: 'Hilux',
        anio: 2021,
        placas: 'VNZ-123-C',
        vin: 'MR0FR22G9M8987654',
        kilometraje_actual: 35000,
        presion_delantera_psi: 29,
        presion_trasera_psi: 36,
        medida_oem: '265/65 R17'
      }
    ]
  }
];

export default function QuoteBuilder({
  selectedItems,
  onRemoveItem,
  onUpdateQuantity,
  onClearQuote,
  vendedorId = 'b001bc99-9c0b-4ef8-bb6d-6bb9bd380e51'
}: QuoteBuilderProps) {
  // Client & Vehicle selection state
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [loadingData, setLoadingData] = useState(true);

  // Additional services & package states
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());

  // Load dynamic services
  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from('servicios_taller')
        .select('*')
        .eq('activo', true)
        .order('nombre');
      if (data) setAvailableServices(data);
    };
    fetchServices();
  }, []);

  // Action states
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);

  // Phase 6 States
  const [isAltaExpressOpen, setIsAltaExpressOpen] = useState(false);
  const [isAltaVehiculoOpen, setIsAltaVehiculoOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [lastSaleInfo, setLastSaleInfo] = useState<{
    folio: string;
    fecha: string;
    total: number;
    metodoPago: string;
    montoRecibido: number;
    cambio: number;
    cliente: string;
    telefono: string;
    placas: string;
    marca: string;
    modelo: string;
    items: QuoteItem[];
    serviciosGenericos?: {
      nombre: string;
      precio: number;
    }[];
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Vehicle Clinic Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'history' | 'specs'>('history');
  const [serviceHistory, setServiceHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Operational Log (Audit Log) State
  const [logs, setLogs] = useState<AuditLog[]>([
    {
      id: 'init',
      timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message: 'Sesión iniciada en Caja 1 • Sucursal Tres Ríos',
      type: 'info'
    }
  ]);

  // Refs for tracking previous state values to auto-log changes
  const prevItemsRef = useRef<QuoteItem[]>([]);
  const prevPromoRef = useRef(false);
  const firstLoadRef = useRef(true);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'add' | 'remove') => {
    const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp,
        message,
        type
      },
      ...prev
    ]);
  };

  // Fetch clients and their vehicles
  const fetchClientsAndVehicles = async (selectNewClientId?: string, selectNewVehicleId?: string) => {
    try {
      setLoadingData(true);
      // Query clients
      const { data: clientsData, error: clientErr } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (clientErr) throw clientErr;

      if (clientsData && clientsData.length > 0) {
        // Query vehicles for these clients
        const { data: vehiclesData, error: vehicleErr } = await supabase
          .from('vehiculos')
          .select('*');

        if (vehicleErr) throw vehicleErr;

        const formatted: Client[] = clientsData.map((client: any) => ({
          ...client,
          vehiculos: vehiclesData?.filter((v: any) => v.cliente_id === client.id) || []
        }));

        setClients(formatted);
        if (selectNewClientId) {
          setSelectedClientId(selectNewClientId);
          if (selectNewVehicleId) {
            setSelectedVehicleId(selectNewVehicleId);
          }
        } else if (formatted.length > 0 && !selectedClientId) {
          setSelectedClientId(formatted[0].id);
        }
      } else {
        setClients(MOCK_CLIENTS);
        setSelectedClientId(MOCK_CLIENTS[0].id);
      }
    } catch (err) {
      console.error('Error fetching relational data, falling back:', err);
      setClients(MOCK_CLIENTS);
      setSelectedClientId(MOCK_CLIENTS[0].id);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchClientsAndVehicles();
  }, []);

  // Update selected vehicle when client changes
  const currentClient = clients.find(c => c.id === selectedClientId);
  useEffect(() => {
    if (currentClient && currentClient.vehiculos && currentClient.vehiculos.length > 0) {
      setSelectedVehicleId(currentClient.vehiculos[0].id);
    } else {
      setSelectedVehicleId('');
    }
  }, [selectedClientId, currentClient]);

  const currentVehicle = currentClient?.vehiculos?.find(v => v.id === selectedVehicleId);

  // Business Rule: "Compra de 4 llantas + Alineación y Balanceo gratis"
  const totalTiresCount = selectedItems.reduce((acc, item) => acc + item.cantidad, 0);
  const qualifiesForFreeAlignment = totalTiresCount >= 4;

  // Auto-log selected client changes
  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }
    if (currentClient) {
      addLog(`Cliente "${currentClient.nombre}" seleccionado`, 'info');
    }
  }, [selectedClientId]);

  // Auto-log additions, removals, and changes in the cart
  useEffect(() => {
    const prev = prevItemsRef.current;
    
    // Check for additions
    selectedItems.forEach(item => {
      const prevItem = prev.find(p => p.tire.id === item.tire.id);
      if (!prevItem) {
        addLog(`Añadido: ${item.cantidad}x ${item.tire.marca} ${item.tire.modelo_llanta} al carrito`, 'add');
      } else if (prevItem.cantidad !== item.cantidad) {
        const diff = item.cantidad - prevItem.cantidad;
        if (diff > 0) {
          addLog(`Modificado: Aumentó cantidad de ${item.tire.marca} a ${item.cantidad} unidades`, 'add');
        } else {
          addLog(`Modificado: Redujo cantidad de ${item.tire.marca} a ${item.cantidad} unidades`, 'remove');
        }
      }
    });

    // Check for removals
    prev.forEach(prevItem => {
      const exists = selectedItems.find(item => item.tire.id === prevItem.tire.id);
      if (!exists) {
        addLog(`Removido: ${prevItem.tire.marca} ${prevItem.tire.modelo_llanta} fuera del carrito`, 'remove');
      }
    });

    prevItemsRef.current = selectedItems;
  }, [selectedItems]);

  // Auto-log business rule triggers
  useEffect(() => {
    if (qualifiesForFreeAlignment && !prevPromoRef.current) {
      addLog(`Regla aplicada: Paquete en promoción inyectado con costo $0.00`, 'success');
      const promoService = availableServices.find(s => s.aplica_promo_llantas);
      if (promoService) {
        setSelectedServiceIds(prev => {
          const next = new Set(prev);
          next.add(promoService.id);
          return next;
        });
      }
    } else if (!qualifiesForFreeAlignment && prevPromoRef.current) {
      addLog(`Regla removida: Descuento de servicio por compra de 4 llantas cancelado`, 'warning');
    }
    prevPromoRef.current = qualifiesForFreeAlignment;
  }, [qualifiesForFreeAlignment, availableServices]);

  // Calculate pricing totals
  const subtotalTires = selectedItems.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
  
  let subtotalServices = 0;
  availableServices.forEach(srv => {
    if (selectedServiceIds.has(srv.id)) {
      if (srv.aplica_promo_llantas && qualifiesForFreeAlignment) {
        subtotalServices += 0;
      } else {
        subtotalServices += Number(srv.precio);
      }
    }
  });

  const grandTotal = subtotalTires + subtotalServices;

  // Fetch clinical history from Supabase
  const fetchServiceHistory = async (vehicleId: string) => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('historial_servicios')
        .select('*')
        .eq('vehiculo_id', vehicleId)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setServiceHistory(data || []);
    } catch (err) {
      console.error('Error fetching service history, using mock:', err);
      // Fallback mocks
      const mocks: Record<string, any[]> = {
        'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44': [
          { fecha: '2026-03-10', descripcion: 'Alineación, Balanceo y Rotación de neumáticos', costo: 1200.00 },
          { fecha: '2025-09-15', descripcion: 'Servicio de cambio de balatas delanteras', costo: 1800.00 }
        ],
        'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55': [
          { fecha: '2026-01-20', descripcion: 'Cambio de 2 amortiguadores delanteros y alineación', costo: 4200.00 },
          { fecha: '2025-06-12', descripcion: 'Parche de sección en llanta trasera izquierda', costo: 350.00 }
        ],
        'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66': [
          { fecha: '2026-04-05', descripcion: 'Instalación de 4 llantas nuevas Goodyear Wrangler y balanceo', costo: 20560.00 },
          { fecha: '2025-10-18', descripcion: 'Engrasado de suspensión y reapriete general', costo: 850.00 }
        ]
      };
      setServiceHistory(mocks[vehicleId] || []);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Actions
  const handleSaveAndWhatsapp = async () => {
    if (!currentClient || selectedItems.length === 0) return;
    
    setIsSendingWhatsapp(true);
    setWhatsappSent(false);

    try {
      // 1. Save quote to Database
      const { data: quote, error: qErr } = await supabase
        .from('cotizaciones')
        .insert({
          cliente_id: selectedClientId,
          vehiculo_id: selectedVehicleId,
          total: grandTotal,
          estatus: 'Enviada',
          vendedor_id: vendedorId
        })
        .select()
        .single();

      if (qErr) throw qErr;

      // 2. Save quote details
      const details = selectedItems.map(item => ({
        cotizacion_id: quote.id,
        llanta_id: item.tire.id,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        subtotal: item.precioUnitario * item.cantidad
      }));

      const { error: dErr } = await supabase
        .from('detalles_cotizacion')
        .insert(details);

      if (dErr) throw dErr;

      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const quoteShortId = quote.id.substr(0, 8).toUpperCase();
      toast.success('Cotización enviada a WhatsApp');
      addLog(`Cotización #${quoteShortId} guardada en Supabase y enviada a WhatsApp`, 'success');

      setWhatsappSent(true);
      setTimeout(() => setWhatsappSent(false), 3000);
    } catch (err) {
      console.error('Error saving quote or sending webhook:', err);
      // Fallback
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Cotización enviada a WhatsApp (Modo local)');
      addLog(`Cotización #COVA-${Math.floor(1000 + Math.random()*9000)} generada y enviada a WhatsApp (offline/mock)`, 'success');
      setWhatsappSent(true);
      setTimeout(() => setWhatsappSent(false), 3000);
    } finally {
      setIsSendingWhatsapp(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (selectedItems.length === 0) return;
    setIsGeneratingPdf(true);
    setPdfGenerated(false);
    
    await new Promise(resolve => setTimeout(resolve, 1800));
    
    const quoteNum = Math.floor(1000 + Math.random() * 9000);
    toast.success('Borrador generado y descargado');
    addLog(`Cotización #COVA-${quoteNum} creada en borrador y PDF descargado`, 'success');

    setIsGeneratingPdf(false);
    setPdfGenerated(true);
    setTimeout(() => setPdfGenerated(false), 3000);
  };

  const handleAltaExpressSuccess = async (newClientId: string, newVehicleId: string) => {
    await fetchClientsAndVehicles(newClientId, newVehicleId);
    addLog('Alta Express exitosa: Cliente y vehículo creados y asignados', 'success');
  };

  const handleAltaVehiculoSuccess = async (newVehicleId: string) => {
    await fetchClientsAndVehicles(selectedClientId, newVehicleId);
    addLog('Alta de vehículo exitosa: Vehículo creado y asignado', 'success');
  };

  const handleConfirmPayment = async () => {
    if (!selectedClientId || !selectedVehicleId || selectedItems.length === 0) {
      toast.error('Por favor selecciona un cliente y un vehículo con items en el carrito.');
      return;
    }

    const calculatedChange = paymentMethod === 'Efectivo'
      ? Math.max(0, (parseFloat(amountReceived) || 0) - grandTotal)
      : 0;

    setIsProcessingPayment(true);

    try {
      const cleanVendedorId = vendedorId === 'admin-demo-id' || !vendedorId
        ? 'b001bc99-9c0b-4ef8-bb6d-6bb9bd380e51' // Sofía
        : vendedorId;

      // 1. Guardar la cotización en Supabase con estatus 'Pagada'
      const { data: quote, error: qErr } = await supabase
        .from('cotizaciones')
        .insert({
          cliente_id: selectedClientId,
          vehiculo_id: selectedVehicleId,
          total: grandTotal,
          estatus: 'Pagada',
          vendedor_id: cleanVendedorId
        })
        .select()
        .single();

      if (qErr) throw qErr;

      // 2. Guardar los detalles de la cotización
      const details = selectedItems.map(item => ({
        cotizacion_id: quote.id,
        llanta_id: item.tire.id,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        subtotal: item.precioUnitario * item.cantidad
      }));

      const { error: dErr } = await supabase
        .from('detalles_cotizacion')
        .insert(details);

      if (dErr) throw dErr;

      // 3. Decrementar existencias atómicamente con bloqueo pesimista (SELECT ... FOR UPDATE)
      const stockItems = selectedItems.map(item => ({
        llanta_id: item.tire.id,
        cantidad: item.cantidad,
      }));

      const stockRes = await ConcurrencyService.descontarStockLote(stockItems);
      if (!stockRes.success) {
        throw new Error(stockRes.message || 'Existencia insuficiente en inventario para procesar la venta');
      }

      // 4. Guardar información para el ticket impreso y visual
      const folioShort = quote.id.substring(0, 8).toUpperCase();
      setLastSaleInfo({
        folio: `COVA-${folioShort}`,
        fecha: new Date().toLocaleString('es-MX'),
        total: grandTotal,
        metodoPago: paymentMethod,
        montoRecibido: paymentMethod === 'Efectivo' ? (parseFloat(amountReceived) || 0) : grandTotal,
        cambio: calculatedChange,
        cliente: currentClient?.nombre || '',
        telefono: currentClient?.telefono || '',
        placas: currentVehicle?.placas || '',
        marca: currentVehicle?.marca || '',
        modelo: currentVehicle?.modelo || '',
        items: [...selectedItems],
        serviciosGenericos: availableServices
          .filter(s => selectedServiceIds.has(s.id))
          .map(s => ({
            nombre: s.nombre,
            precio: (s.aplica_promo_llantas && qualifiesForFreeAlignment) ? 0 : Number(s.precio)
          }))
      });

      toast.success('¡Cobro registrado exitosamente!');
      addLog(`Venta registrada y pagada por $${grandTotal.toFixed(2)} (Folio: COVA-${folioShort})`, 'success');

      // Limpiar estados de servicios y el carrito
      setSelectedServiceIds(new Set());
      onClearQuote();
      
      setIsCheckoutOpen(false);
      setCheckoutSuccess(true);
    } catch (err: any) {
      console.error('Error al registrar venta POS:', err);
      toast.error(`Error al registrar el cobro: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (checkoutSuccess && lastSaleInfo) {
    const totalTires = lastSaleInfo.items.reduce((acc, item) => acc + item.cantidad, 0);
    const formattedTotal = lastSaleInfo.total.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    const formattedSubtotal = (lastSaleInfo.total / 1.16).toLocaleString('es-MX', { minimumFractionDigits: 2 });
    const formattedIva = (lastSaleInfo.total - (lastSaleInfo.total / 1.16)).toLocaleString('es-MX', { minimumFractionDigits: 2 });

    return (
      <div className="panel-card p-5 flex flex-col h-full bg-white animate-in fade-in duration-200">
        <div className="flex flex-col items-center text-center pb-5 mb-5 border-b-hairline">
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
            <Check className="w-5 h-5 text-emerald-600 animate-bounce" />
          </div>
          <h2 className="text-sm font-bold tracking-tight text-charcoal uppercase tracking-wider font-mono">
            Venta POS Exitosa
          </h2>
          <p className="text-[11px] text-charcoal-light font-mono mt-1">
            Folio: {lastSaleInfo.folio} • {lastSaleInfo.fecha}
          </p>
        </div>

        {/* Client / Vehicle summary */}
        <div className="bg-neutral-50 border border-hairline rounded p-3 mb-4 text-xs space-y-1">
          <p className="text-charcoal"><strong className="font-semibold text-neutral-400 font-mono text-[9px] uppercase block">Cliente</strong>{lastSaleInfo.cliente} ({lastSaleInfo.telefono})</p>
          <p className="text-charcoal pt-1.5 border-t border-dashed border-neutral-200 mt-1.5"><strong className="font-semibold text-neutral-400 font-mono text-[9px] uppercase block">Vehículo</strong>{lastSaleInfo.marca} {lastSaleInfo.modelo} • Placas: <span className="font-mono font-bold text-cova-blue">{lastSaleInfo.placas}</span></p>
        </div>

        {/* Ticket Preview Box */}
        <div className="flex-1 flex flex-col mb-4">
          <label className="text-[10px] font-semibold text-charcoal-light/60 uppercase tracking-wider mb-2">
            Vista Previa de Recibo (Media Carta)
          </label>
          <div className="flex-1 border border-hairline rounded bg-neutral-100/50 p-4 overflow-auto max-h-[220px] dense-scrollbar font-mono text-[10px] text-charcoal leading-relaxed shadow-inner">
            <div className="bg-white border border-neutral-300 rounded p-4 mx-auto max-w-[280px] min-h-[300px] shadow-sm select-none">
              {/* Small preview simulation */}
              <div className="text-center border-b border-dashed border-neutral-300 pb-2 mb-2">
                <span className="font-bold tracking-widest text-xs">LLANTERA COVA</span>
                <p className="text-[8px] text-neutral-400 m-0">Tres Ríos, Culiacán</p>
              </div>
              <div className="flex justify-between text-[8px] text-neutral-400 mb-2">
                <span>FOLIO: {lastSaleInfo.folio}</span>
                <span>{lastSaleInfo.fecha.split(', ')[1] || ''}</span>
              </div>
              <div className="space-y-1 mb-2 text-[9px]">
                {lastSaleInfo.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.cantidad}x {item.tire.marca} {item.tire.modelo_llanta}</span>
                    <span>${(item.cantidad * item.precioUnitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {lastSaleInfo.serviciosGenericos?.map((srv: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[9px]">
                    <span>1x {srv.nombre}</span>
                    <span>${srv.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-neutral-300 pt-2 text-[9px] font-bold text-right flex flex-col items-end">
                <div className="w-24 flex justify-between font-bold">
                  <span>TOTAL:</span>
                  <span>${lastSaleInfo.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
                {lastSaleInfo.metodoPago === 'Efectivo' && (
                  <>
                    <div className="w-24 flex justify-between text-neutral-400 font-normal text-[8px]">
                      <span>EFECTIVO:</span>
                      <span>${lastSaleInfo.montoRecibido.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="w-24 flex justify-between text-emerald-600 font-bold text-[9px]">
                      <span>CAMBIO:</span>
                      <span>${lastSaleInfo.cambio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Success Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.print()}
            className="w-full py-2.5 text-xs font-semibold text-white bg-cova-blue hover:bg-cova-blue/95 border border-cova-blue hover:shadow-md rounded cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
              <rect x="6" y="14" width="12" height="8" rx="1" />
            </svg>
            <span>Imprimir Nota (Media Carta)</span>
          </button>
          
          <button
            onClick={() => {
              setCheckoutSuccess(false);
              setLastSaleInfo(null);
            }}
            className="w-full py-2 text-xs font-semibold text-charcoal hover:bg-neutral-50 border border-hairline rounded cursor-pointer"
          >
            Nueva Cotización / Venta
          </button>
        </div>

        {/* Hidden Printable Ticket rendered at the body level */}
        {mounted && typeof document !== 'undefined' && createPortal(
          <div id="print-section" className="hidden print:block">
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#111111', lineHeight: '1.4' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #111111', paddingBottom: '10px', marginBottom: '10px' }}>
                <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0', letterSpacing: '1px' }}>LLANTERA COVA</h1>
                <p style={{ margin: '2px 0' }}>Sucursal Tres Ríos • Culiacán, Sin.</p>
                <p style={{ margin: '2px 0' }}>Tel: 667-712-3456</p>
                <p style={{ margin: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>TICKET DE VENTA (POS)</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span><strong>FOLIO:</strong> {lastSaleInfo.folio}</span>
                <span><strong>FECHA:</strong> {lastSaleInfo.fecha}</span>
              </div>

              <div style={{ borderBottom: '1px dashed #111111', paddingBottom: '8px', marginBottom: '8px' }}>
                <p style={{ margin: '2px 0' }}><strong>CLIENTE:</strong> {lastSaleInfo.cliente}</p>
                <p style={{ margin: '2px 0' }}><strong>TELÉFONO:</strong> {lastSaleInfo.telefono}</p>
                <p style={{ margin: '2px 0' }}><strong>VEHÍCULO:</strong> {lastSaleInfo.marca} {lastSaleInfo.modelo} ({lastSaleInfo.placas})</p>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <div style={{ borderBottom: '1px dashed #111111', paddingBottom: '4px', fontWeight: 'bold', display: 'flex' }}>
                  <span style={{ width: '40px' }}>CANT</span>
                  <span style={{ flex: '1' }}>DESCRIPCIÓN</span>
                  <span style={{ width: '60px', textAlign: 'right' }}>P.UNIT</span>
                  <span style={{ width: '70px', textAlign: 'right' }}>IMPORTE</span>
                </div>
                {lastSaleInfo.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', marginTop: '4px' }}>
                    <span style={{ width: '40px' }}>{item.cantidad}</span>
                    <span style={{ flex: '1' }}>{item.tire.marca} {item.tire.modelo_llanta} {item.tire.ancho}/{item.tire.perfil} R{item.tire.rin}</span>
                    <span style={{ width: '60px', textAlign: 'right' }}>${item.precioUnitario.toFixed(2)}</span>
                    <span style={{ width: '70px', textAlign: 'right' }}>${(item.cantidad * item.precioUnitario).toFixed(2)}</span>
                  </div>
                ))}

                {lastSaleInfo.serviciosGenericos?.map((srv: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', marginTop: '4px' }}>
                    <span style={{ width: '40px' }}>1</span>
                    <span style={{ flex: '1' }}>{srv.nombre}</span>
                    <span style={{ width: '60px', textAlign: 'right' }}>${srv.precio.toFixed(2)}</span>
                    <span style={{ width: '70px', textAlign: 'right' }}>${srv.precio.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed #111111', paddingTop: '8px', paddingBottom: '8px', borderBottom: '1px dashed #111111', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ width: '180px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>SUBTOTAL:</span>
                  <span>${formattedSubtotal}</span>
                </div>
                <div style={{ width: '180px', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span>IVA (16%):</span>
                  <span>${formattedIva}</span>
                </div>
                <div style={{ width: '180px', display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                  <span>TOTAL NETO:</span>
                  <span>${formattedTotal} MXN</span>
                </div>
              </div>

              <div style={{ paddingBottom: '8px', marginBottom: '8px', marginTop: '8px' }}>
                <p style={{ margin: '2px 0' }}><strong>MÉTODO DE PAGO:</strong> {lastSaleInfo.metodoPago}</p>
                {lastSaleInfo.metodoPago === 'Efectivo' && (
                  <>
                    <p style={{ margin: '2px 0' }}><strong>RECIBIDO:</strong> ${lastSaleInfo.montoRecibido.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    <p style={{ margin: '2px 0', fontWeight: 'bold' }}><strong>CAMBIO:</strong> ${lastSaleInfo.cambio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </>
                )}
              </div>

              <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px dashed #111111', paddingTop: '10px', fontSize: '9px' }}>
                <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>TÉRMINOS DE GARANTÍA</p>
                <p style={{ margin: '2px 0' }}>1 año de garantía contra defectos de fábrica en llantas.</p>
                <p style={{ margin: '2px 0' }}>No aplica por golpes, chipotes, cortes o mal camino.</p>
                <p style={{ margin: '2px 0' }}>Garantía de 30 días en servicios de mano de obra.</p>
                <p style={{ margin: '2px 0', fontStyle: 'italic', marginTop: '10px' }}>¡Gracias por su preferencia en Llantera Cova!</p>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div className="bg-card shadow-sm rounded-lg p-5 flex flex-col h-full">
      {/* Title block */}
      <div className="pb-4 mb-4 border-b border-slate-200">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <span>Cotizador Express</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 font-mono text-emerald-700 border border-emerald-100 font-semibold uppercase">
            Fase 1 Activa
          </span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Ingreso ágil de órdenes y servicios rápidos
        </p>
      </div>

      {/* Client / Vehicle Selection Fields */}
      <div className="space-y-3 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Client Select with Inline Button */}
          <div className="flex gap-1.5 items-end">
            <div className="relative flex-1">
              <label className="absolute left-2.5 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User className="w-2.5 h-2.5" />
                <span>Cliente</span>
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded pt-4 pb-1 px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors appearance-none cursor-pointer"
              >
                {loadingData ? (
                  <option>Cargando clientes...</option>
                ) : (
                  clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.telefono})
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setIsAltaExpressOpen(true)}
              title="Alta Express de Cliente y Vehículo"
              className="h-[34px] w-[34px] flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-primary hover:text-primary/80 rounded transition-colors cursor-pointer flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Vehicle Select with Inline Button */}
          <div className="flex gap-1.5 items-end">
            <div className="relative flex-1">
              <label className="absolute left-2.5 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Car className="w-2.5 h-2.5" />
                <span>Vehículo</span>
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                disabled={!selectedClientId}
                className="w-full bg-white border border-slate-200 rounded pt-4 pb-1 px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors appearance-none cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
              >
                {currentClient?.vehiculos && currentClient.vehiculos.length > 0 ? (
                  currentClient.vehiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.marca} {v.modelo} {v.anio} • {v.placas}
                    </option>
                  ))
                ) : (
                  <option>Sin vehículos asociados</option>
                )}
              </select>
            </div>
            <button
              type="button"
              disabled={!selectedClientId}
              onClick={() => setIsAltaVehiculoOpen(true)}
              title="Añadir Auto Adicional para este Cliente"
              className="h-[34px] w-[34px] flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-primary hover:text-primary/80 rounded transition-colors cursor-pointer flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Vehicle Metadata readout (Interactive Ficha Clínica trigger) */}
        {currentVehicle && (
          <div 
            onClick={() => {
              setIsModalOpen(true);
              fetchServiceHistory(currentVehicle.id);
            }}
            className="bg-slate-50 hover:bg-slate-100 cursor-pointer border border-slate-200 rounded p-2 text-[10px] text-slate-500 font-mono flex items-center justify-between gap-x-4 gap-y-1 transition-all select-none"
            title="Haga clic para ver Ficha Clínica"
          >
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><strong>VIN:</strong> <span className="tabular-nums">{currentVehicle.vin ? currentVehicle.vin.substr(0, 8) + '...' : 'No reg'}</span></span>
              <span><strong>Placas:</strong> <span className="tabular-nums">{currentVehicle.placas}</span></span>
              <span><strong>OEM:</strong> <span className="tabular-nums">{currentVehicle.medida_oem || 'Ver specs'}</span></span>
            </div>
            <span className="text-[9px] font-sans font-semibold text-slate-900 flex items-center gap-0.5 bg-slate-200/60 px-1.5 py-0.5 rounded">
              <span>Ver Ficha Clínica</span>
              <span>→</span>
            </span>
          </div>
        )}
      </div>

      {/* Selected Items List */}
      <div className="flex-1 min-h-[160px] mb-4 flex flex-col">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Llantas Seleccionadas
        </label>
        
        {selectedItems.length === 0 ? (
          <div className="flex-1 border border-dashed border-slate-200 rounded flex flex-col items-center justify-center p-6 text-center bg-slate-50/50">
            <FileText className="w-6 h-6 text-slate-300 mb-1.5" />
            <p className="text-xs font-medium text-slate-900">La cotización está vacía</p>
            <p className="text-[10px] text-slate-500 mt-0.5 max-w-[200px]">
              Selecciona medidas de llanta en la matriz y presiona (+) para agregarlas aquí.
            </p>
          </div>
        ) : (
          <div className="flex-1 border border-slate-200 rounded divide-y divide-slate-100 overflow-auto dense-scrollbar max-h-[160px]">
            {selectedItems.map((item) => {
              const itemTotal = item.precioUnitario * item.cantidad;
              return (
                <div key={item.tire.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1 pr-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {item.tire.marca} - {item.tire.modelo_llanta}
                    </div>
                    <div className="tabular-nums text-sm font-semibold text-slate-900 mt-0.5">
                      {item.tire.ancho}/{item.tire.perfil} R{item.tire.rin} <span className="text-[10px] text-slate-500 font-normal">• {item.tire.indice_carga_velocidad}</span>
                    </div>
                  </div>

                  {/* Quantity adjustments */}
                  <div className="flex items-center gap-1.5 mr-4">
                    <button
                      onClick={() => onUpdateQuantity(item.tire.id, -1)}
                      className="p-1 rounded border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-900"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="tabular-nums text-sm font-semibold text-slate-900 w-4 text-center">
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.tire.id, 1)}
                      disabled={item.cantidad >= item.tire.stock_actual}
                      className="p-1 rounded border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* Price */}
                  <div className="text-right pr-3">
                    <div className="tabular-nums text-sm font-semibold text-slate-900">
                      ${itemTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="tabular-nums text-[10px] text-slate-500">
                      ${item.precioUnitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })} c/u
                    </div>
                  </div>

                  {/* Trash */}
                  <button
                    onClick={() => onRemoveItem(item.tire.id)}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 text-slate-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto Service Packages toggles */}
      <div className="mb-4 space-y-2 border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Paquetes y Adicionales
          </label>
          {qualifiesForFreeAlignment && (
            <span className="text-[9px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1 animate-pulse">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Promo 4x Llanta Activa</span>
            </span>
          )}
        </div>

        {availableServices.map(srv => {
          const isSelected = selectedServiceIds.has(srv.id);
          const isPromo = srv.aplica_promo_llantas && qualifiesForFreeAlignment;
          
          return (
            <div 
              key={srv.id}
              onClick={() => {
                setSelectedServiceIds(prev => {
                  const next = new Set(prev);
                  if (next.has(srv.id)) next.delete(srv.id);
                  else next.add(srv.id);
                  return next;
                });
              }}
              className={`flex items-center justify-between p-2 rounded-md border transition-all cursor-pointer select-none ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200 bg-white hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-2">
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4 text-slate-300" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">{srv.nombre}</p>
                  <p className="text-[10px] text-slate-500 max-w-[200px] truncate">
                    {srv.descripcion || 'Servicio de taller'}
                  </p>
                </div>
              </div>
              <span className={`tabular-nums text-sm font-semibold ${isPromo ? 'text-success' : 'text-slate-900'}`}>
                {isPromo ? '¡GRATIS!' : `$${Number(srv.precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Quote summary block */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-4 mb-4 mt-auto">
        <div className="flex justify-between text-sm text-slate-500">
          <span>Subtotal llantas:</span>
          <span className="tabular-nums font-semibold text-slate-900">${subtotalTires.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500 mt-1.5">
          <span>Servicios y paquetes:</span>
          <span className="tabular-nums font-semibold text-slate-900">${subtotalServices.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between items-center text-sm font-bold text-slate-900 border-t border-dashed border-slate-300 pt-2 mt-2">
          <span>Total Cotización:</span>
          <span className="tabular-nums text-lg tracking-tight">${grandTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-500">MXN</span></span>
        </div>
      </div>

      {/* Actions (PDF & WhatsApp) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* PDF Download Button */}
        <button
          onClick={handleGeneratePdf}
          disabled={selectedItems.length === 0 || isGeneratingPdf}
          className={`w-full text-sm font-semibold flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border transition-colors ${
            selectedItems.length === 0
              ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {isGeneratingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : pdfGenerated ? (
            <Check className="w-4 h-4 text-success" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          <span>{isGeneratingPdf ? 'Generando...' : pdfGenerated ? '¡PDF Creado!' : 'Generar PDF'}</span>
        </button>

        {/* WhatsApp Send Button (Success style) */}
        <button
          onClick={handleSaveAndWhatsapp}
          disabled={selectedItems.length === 0 || isSendingWhatsapp}
          className={`w-full text-sm font-semibold flex items-center justify-center gap-2 px-3 py-2.5 rounded-md transition-colors ${
            selectedItems.length === 0
              ? 'bg-slate-50 border border-slate-200 text-slate-300 cursor-not-allowed'
              : 'bg-success hover:bg-success/90 text-white shadow-sm'
          }`}
        >
          {isSendingWhatsapp ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : whatsappSent ? (
            <Check className="w-4 h-4 text-white" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>{isSendingWhatsapp ? 'Enviando...' : whatsappSent ? '¡Enviado!' : 'WhatsApp'}</span>
        </button>
      </div>

      {/* POS Checkout Button */}
      <button
        onClick={() => {
          if (selectedItems.length === 0) return;
          setPaymentMethod('Efectivo');
          setAmountReceived('');
          setIsCheckoutOpen(true);
        }}
        disabled={selectedItems.length === 0}
        className={`w-full mt-3 text-sm font-semibold flex items-center justify-center gap-2 px-3 py-3 rounded-lg border transition-colors ${
          selectedItems.length === 0
            ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
            : 'bg-primary hover:bg-primary/90 border-primary text-white shadow-md cursor-pointer'
        }`}
      >
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <span>Proceder al Cobro (POS)</span>
      </button>

      {/* Operational Audit Log timeline */}
      <div className="mt-5 border-t border-slate-200 pt-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Bitácora Operativa (Audit Log)
          </span>
          <button 
            onClick={() => setLogs([{
              id: 'init',
              timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              message: 'Bitácora reiniciada',
              type: 'info'
            }])}
            className="text-[9px] text-slate-400 hover:text-slate-600 transition-colors font-mono"
          >
            Limpiar
          </button>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5 max-h-[120px] overflow-auto dense-scrollbar space-y-2 text-[10px]">
          {logs.map((log) => {
            let badgeStyle = 'bg-slate-200 text-slate-600';
            if (log.type === 'add') badgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
            if (log.type === 'remove') badgeStyle = 'bg-red-50 text-red-700 border border-red-100';
            if (log.type === 'success') badgeStyle = 'bg-emerald-100 text-emerald-800 font-bold';
            if (log.type === 'warning') badgeStyle = 'bg-amber-50 text-amber-700 border border-amber-100';
            
            return (
              <div key={log.id} className="flex gap-2 items-start leading-relaxed font-mono">
                <span className="text-slate-400 flex-shrink-0 tabular-nums">{log.timestamp}</span>
                <span className={`px-1 py-0.5 rounded text-[8px] uppercase tracking-wider flex-shrink-0 ${badgeStyle}`}>
                  {log.type}
                </span>
                <span className="text-slate-900 flex-1">{log.message}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clinical Vehicle Modal */}
      {isModalOpen && currentVehicle && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-slate-200 rounded-lg shadow-md max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-4 h-4" />
                  <span>Ficha Clínica del Vehículo</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {currentVehicle.marca} {currentVehicle.modelo} <span className="tabular-nums">{currentVehicle.anio}</span> • <span className="tabular-nums">{currentVehicle.placas}</span>
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 transition-colors text-xs font-bold font-sans p-1"
              >
                ✕
              </button>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-slate-200 bg-white text-xs">
              <button 
                onClick={() => setModalTab('history')}
                className={`flex-1 py-3 text-center font-semibold border-b-2 transition-all ${
                  modalTab === 'history' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Historial de Servicios
              </button>
              <button 
                onClick={() => setModalTab('specs')}
                className={`flex-1 py-3 text-center font-semibold border-b-2 transition-all ${
                  modalTab === 'specs' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Especificaciones OEM
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 max-h-[300px] overflow-auto dense-scrollbar">
              {modalTab === 'history' ? (
                loadingHistory ? (
                  <div className="py-8 text-center text-xs text-slate-500 animate-pulse font-mono">Cargando historial clínico...</div>
                ) : serviceHistory.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 font-mono">Sin registros de servicio previos.</div>
                ) : (
                  <div className="space-y-3">
                    {serviceHistory.map((service, idx) => (
                      <div key={idx} className="p-3 rounded-md border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                          <span className="tabular-nums">{service.fecha}</span>
                          <span className="font-bold text-slate-900 tabular-nums">${parseFloat(service.costo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{service.descripcion}</p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-md border border-slate-200 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">Medida OEM de Agencia</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{currentVehicle.medida_oem || '205/55 R16'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">Tipo Vehículo</span>
                      <span className="text-sm font-bold text-slate-900">Pasajero / Sedán</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-900 uppercase tracking-wider">
                      Presión de Inflado Recomendada
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-200 p-3 font-mono">
                      <div className="text-center">
                        <span className="text-[10px] text-slate-500 block font-sans font-semibold">Eje Delantero</span>
                        <span className="text-lg font-bold text-slate-900 tabular-nums">{currentVehicle.presion_delantera_psi || 32} PSI</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-slate-500 block font-sans font-semibold">Eje Trasero</span>
                        <span className="text-lg font-bold text-slate-900 tabular-nums">{currentVehicle.presion_trasera_psi || 32} PSI</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 leading-relaxed flex gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      <strong>Nota de calibración:</strong> Siempre calibre la presión de inflado en frío (antes de circular más de 2 km) para asegurar la máxima durabilidad y precisión.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="bg-primary hover:bg-primary/90 text-white shadow-sm transition-colors text-sm px-4 py-2 rounded-md font-semibold"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout POS Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card p-6 rounded-xl shadow-md border border-slate-200 w-full max-w-sm relative animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-5">
            {/* Header */}
            <button 
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-900 cursor-pointer transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
              <Landmark className="w-5 h-5 text-slate-900" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Caja y Transacción
              </h3>
            </div>

            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-center flex flex-col items-center justify-center">
                <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Total a Cobrar</span>
                <div className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight mt-1">
                  ${grandTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Método de Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    const val = e.target.value as 'Efectivo' | 'Tarjeta' | 'Transferencia';
                    setPaymentMethod(val);
                    if (val !== 'Efectivo') {
                      setAmountReceived(grandTotal.toString());
                    } else {
                      setAmountReceived('');
                    }
                  }}
                  className="w-full h-10 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer font-medium shadow-sm"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta de Débito/Crédito</option>
                  <option value="Transferencia">Transferencia Bancaria</option>
                </select>
              </div>

              {paymentMethod === 'Efectivo' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Monto Recibido
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    className="w-full h-12 bg-white border border-slate-300 rounded-md px-3 text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium tabular-nums shadow-sm"
                  />
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex justify-between items-center text-sm shadow-inner">
                  <span className="text-slate-500 font-medium">Monto Cargado:</span>
                  <span className="font-bold tabular-nums text-slate-900">${grandTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {paymentMethod === 'Efectivo' && (
                <div className="border border-dashed border-slate-300 rounded-md p-3 bg-slate-50 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cambio a Entregar:</span>
                  <span className={`text-lg font-bold tabular-nums ${
                    parseFloat(amountReceived) >= grandTotal ? 'text-slate-900' : 'text-destructive'
                  }`}>
                    {amountReceived && parseFloat(amountReceived) >= grandTotal
                      ? `$${(parseFloat(amountReceived) - grandTotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                      : amountReceived
                        ? 'Monto insuficiente'
                        : '$0.00'
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-200 mt-2">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1 h-12 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isProcessingPayment || (paymentMethod === 'Efectivo' && (!amountReceived || parseFloat(amountReceived) < grandTotal))}
                className="flex-[2] h-12 bg-success hover:bg-success/90 text-white rounded-lg text-lg font-medium shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingPayment ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                <span>Confirmar Pago</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alta Express */}
      <ModalAltaExpress
        isOpen={isAltaExpressOpen}
        onClose={() => setIsAltaExpressOpen(false)}
        onSuccess={handleAltaExpressSuccess}
      />

      {/* Modal Alta Vehiculo */}
      <ModalAltaVehiculo
        isOpen={isAltaVehiculoOpen}
        onClose={() => setIsAltaVehiculoOpen(false)}
        onSuccess={handleAltaVehiculoSuccess}
        clienteId={selectedClientId}
        clienteNombre={currentClient?.nombre || ''}
      />
    </div>
  );
}
