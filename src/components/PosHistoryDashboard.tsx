'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Printer, 
  Ban, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { ConcurrencyService } from '@/services/concurrencyService';

export default function PosHistoryDashboard() {
  const { isAdmin } = useRoleAccess();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // States for expansion and details
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [saleDetails, setSaleDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Print portal state
  const [mounted, setMounted] = useState(false);
  const [printData, setPrintData] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cotizaciones')
        .select(`
          id, total, estatus, fecha,
          clientes ( nombre, telefono ),
          vehiculos ( marca, modelo, placas ),
          empleados ( nombre )
        `)
        .in('estatus', ['Pagada', 'Cancelada'])
        .order('fecha', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (err) {
      console.error('Error fetching sales history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (saleId: string) => {
    try {
      setLoadingDetails(true);
      const { data, error } = await supabase
        .from('detalles_cotizacion')
        .select(`
          id, cantidad, precio_unitario, subtotal,
          inventario_llantas ( id, marca, modelo_llanta, ancho, perfil, rin )
        `)
        .eq('cotizacion_id', saleId);

      if (error) throw error;
      setSaleDetails(data || []);
    } catch (err) {
      console.error('Error fetching sale details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleToggleExpand = (saleId: string) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null);
      setSaleDetails([]);
    } else {
      setExpandedSaleId(saleId);
      fetchDetails(saleId);
    }
  };

  const handleReprint = async (sale: any) => {
    // Need to fetch details first if not expanded
    let detailsToPrint = saleDetails;
    if (expandedSaleId !== sale.id) {
      const { data } = await supabase
        .from('detalles_cotizacion')
        .select(`
          cantidad, precio_unitario,
          inventario_llantas ( marca, modelo_llanta, ancho, perfil, rin )
        `)
        .eq('cotizacion_id', sale.id);
      detailsToPrint = data || [];
    }

    const folioShort = sale.id.substring(0, 8).toUpperCase();
    
    // Calculate if there are extra services (Total > Sum of tires)
    const sumTires = detailsToPrint.reduce((acc: number, d: any) => acc + (d.cantidad * d.precio_unitario), 0);
    const extraServices = sale.total - sumTires;

    setPrintData({
      folio: `COVA-${folioShort}`,
      fecha: new Date(sale.fecha).toLocaleString('es-MX'),
      total: sale.total,
      cliente: sale.clientes?.nombre || 'Desconocido',
      telefono: sale.clientes?.telefono || 'N/A',
      placas: sale.vehiculos?.placas || 'N/A',
      marca: sale.vehiculos?.marca || '',
      modelo: sale.vehiculos?.modelo || '',
      vendedor: sale.empleados?.nombre || 'N/A',
      items: detailsToPrint,
      extraServices: extraServices > 0 ? extraServices : 0
    });

    // Wait for state to update, then print
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleCancelSale = async (sale: any) => {
    if (!isAdmin) return;
    if (!confirm(`¿Estás seguro de cancelar la venta folio COVA-${sale.id.substring(0, 8).toUpperCase()}? Esta acción devolverá el stock al inventario.`)) return;

    try {
      // 1. Fetch details to know what to return to stock
      const { data: details, error: dErr } = await supabase
        .from('detalles_cotizacion')
        .select('llanta_id, cantidad')
        .eq('cotizacion_id', sale.id);
      
      if (dErr) throw dErr;

      // 2. Return stock atómicamente con bloqueo pesimista en base de datos
      if (details && details.length > 0) {
        for (const item of details) {
          await ConcurrencyService.ajustarStock({
            llantaId: item.llanta_id,
            delta: item.cantidad,
            permitirNegativo: true,
          });
        }
      }

      // 3. Update status to 'Cancelada'
      const { error: updErr } = await supabase
        .from('cotizaciones')
        .update({ estatus: 'Cancelada' })
        .eq('id', sale.id);

      if (updErr) throw updErr;

      alert('Venta cancelada y stock devuelto exitosamente.');
      fetchSales(); // Refresh
    } catch (err: any) {
      console.error('Error canceling sale:', err);
      alert('Error al cancelar venta. Asegúrate de haber ejecutado 08_history_schema.sql en la base de datos.');
    }
  };

  const filteredSales = sales.filter(s => 
    s.clientes?.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5 flex-1 animate-in fade-in zoom-in-95 duration-200">
      <div className="panel-card p-5 bg-white flex flex-col shadow-sm">
        <div className="pb-4 mb-4 border-b border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-cova-blue" />
              Historial de Ventas POS
            </h3>
            <p className="text-[11px] text-charcoal-light mt-0.5">
              Consulta transacciones previas, reimprime tickets y gestiona cancelaciones.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Buscar por cliente o folio..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-hairline rounded w-full sm:w-64 bg-neutral-50 focus:outline-none focus:border-cova-blue"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-cova-blue animate-spin" />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-hairline rounded bg-neutral-50">
            <p className="text-xs text-neutral-400">No se encontraron ventas pagadas o canceladas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-charcoal font-sans border-collapse">
              <thead>
                <tr className="bg-neutral-100 border-y border-hairline text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3 font-medium">Fecha / Folio</th>
                  <th className="py-2.5 px-3 font-medium">Cliente</th>
                  <th className="py-2.5 px-3 font-medium">Vehículo</th>
                  <th className="py-2.5 px-3 font-medium">Vendedor</th>
                  <th className="py-2.5 px-3 font-medium">Total</th>
                  <th className="py-2.5 px-3 font-medium">Estado</th>
                  <th className="py-2.5 px-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filteredSales.map((sale) => (
                  <React.Fragment key={sale.id}>
                    <tr className={`hover:bg-neutral-50 transition-colors ${expandedSaleId === sale.id ? 'bg-neutral-50/50' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="font-semibold">{new Date(sale.fecha).toLocaleDateString('es-MX')}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">COVA-{sale.id.substring(0,8).toUpperCase()}</div>
                      </td>
                      <td className="py-3 px-3 font-medium">{sale.clientes?.nombre || '-'}</td>
                      <td className="py-3 px-3">
                        {sale.vehiculos ? `${sale.vehiculos.marca} ${sale.vehiculos.modelo}` : '-'}
                        <div className="text-[10px] text-neutral-400">{sale.vehiculos?.placas}</div>
                      </td>
                      <td className="py-3 px-3 text-charcoal-light">{sale.empleados?.nombre || '-'}</td>
                      <td className="py-3 px-3 font-bold font-mono">
                        ${sale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          sale.estatus === 'Pagada' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          {sale.estatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleToggleExpand(sale.id)}
                            className="p-1.5 text-neutral-400 hover:text-cova-blue hover:bg-cova-blue/10 rounded transition-colors"
                            title="Ver detalles"
                          >
                            {expandedSaleId === sale.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {sale.estatus === 'Pagada' && (
                            <>
                              <button 
                                onClick={() => handleReprint(sale)}
                                className="p-1.5 text-neutral-400 hover:text-charcoal hover:bg-neutral-100 rounded transition-colors"
                                title="Reimprimir Nota"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <button 
                                  onClick={() => handleCancelSale(sale)}
                                  className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Cancelar Venta"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row */}
                    {expandedSaleId === sale.id && (
                      <tr>
                        <td colSpan={7} className="p-0 border-b border-hairline">
                          <div className="bg-neutral-50/50 p-4 shadow-inner">
                            <h4 className="text-[11px] font-bold text-charcoal uppercase tracking-wider mb-2">Detalles de la Transacción</h4>
                            {loadingDetails ? (
                              <div className="flex items-center gap-2 text-xs text-neutral-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando ítems...
                              </div>
                            ) : saleDetails.length === 0 ? (
                              <p className="text-xs text-neutral-400">No hay ítems registrados.</p>
                            ) : (
                              <div className="bg-white border border-hairline rounded overflow-hidden">
                                <table className="w-full text-left text-xs font-mono">
                                  <thead className="bg-neutral-50 text-[10px] text-neutral-400 uppercase border-b border-hairline">
                                    <tr>
                                      <th className="py-1.5 px-3 font-medium">Cant</th>
                                      <th className="py-1.5 px-3 font-medium">Artículo</th>
                                      <th className="py-1.5 px-3 font-medium text-right">P.Unit</th>
                                      <th className="py-1.5 px-3 font-medium text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-hairline">
                                    {saleDetails.map(d => (
                                      <tr key={d.id}>
                                        <td className="py-1.5 px-3">{d.cantidad}</td>
                                        <td className="py-1.5 px-3">
                                          {d.inventario_llantas ? `${d.inventario_llantas.marca} ${d.inventario_llantas.modelo_llanta} ${d.inventario_llantas.ancho}/${d.inventario_llantas.perfil} R${d.inventario_llantas.rin}` : 'Artículo Desconocido'}
                                        </td>
                                        <td className="py-1.5 px-3 text-right">${d.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                        <td className="py-1.5 px-3 text-right font-bold">${d.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                      </tr>
                                    ))}
                                    {/* Mostrar servicios adicionales si hay discrepancia entre suma de llantas y total */}
                                    {(() => {
                                      const sumItems = saleDetails.reduce((acc, d) => acc + d.subtotal, 0);
                                      const extra = sale.total - sumItems;
                                      if (extra > 0.01) {
                                        return (
                                          <tr className="bg-neutral-50/30">
                                            <td className="py-1.5 px-3">1</td>
                                            <td className="py-1.5 px-3 italic">Servicios Adicionales (Alineación, etc.)</td>
                                            <td className="py-1.5 px-3 text-right">${extra.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                            <td className="py-1.5 px-3 text-right font-bold">${extra.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                          </tr>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden Printable Ticket rendered at the body level */}
      {mounted && printData && typeof document !== 'undefined' && createPortal(
        <div id="print-section" className="hidden print:block">
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#111111', lineHeight: '1.4' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #111111', paddingBottom: '10px', marginBottom: '10px' }}>
              <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0', letterSpacing: '1px' }}>LLANTERA COVA</h1>
              <p style={{ margin: '2px 0' }}>Sucursal Tres Ríos • Culiacán, Sin.</p>
              <p style={{ margin: '2px 0' }}>Tel: 667-712-3456</p>
              <p style={{ margin: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>REIMPRESIÓN TICKET DE VENTA (POS)</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span><strong>FOLIO:</strong> {printData.folio}</span>
              <span><strong>FECHA:</strong> {printData.fecha}</span>
            </div>

            <div style={{ borderBottom: '1px dashed #111111', paddingBottom: '8px', marginBottom: '8px' }}>
              <p style={{ margin: '2px 0' }}><strong>CLIENTE:</strong> {printData.cliente}</p>
              <p style={{ margin: '2px 0' }}><strong>TELÉFONO:</strong> {printData.telefono}</p>
              <p style={{ margin: '2px 0' }}><strong>VEHÍCULO:</strong> {printData.marca} {printData.modelo} ({printData.placas})</p>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ borderBottom: '1px dashed #111111', paddingBottom: '4px', fontWeight: 'bold', display: 'flex' }}>
                <span style={{ width: '40px' }}>CANT</span>
                <span style={{ flex: '1' }}>DESCRIPCIÓN</span>
                <span style={{ width: '60px', textAlign: 'right' }}>P.UNIT</span>
                <span style={{ width: '70px', textAlign: 'right' }}>IMPORTE</span>
              </div>
              {printData.items.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', marginTop: '4px' }}>
                  <span style={{ width: '40px' }}>{item.cantidad}</span>
                  <span style={{ flex: '1' }}>
                    {item.inventario_llantas ? `${item.inventario_llantas.marca} ${item.inventario_llantas.modelo_llanta} ${item.inventario_llantas.ancho}/${item.inventario_llantas.perfil} R${item.inventario_llantas.rin}` : 'Artículo'}
                  </span>
                  <span style={{ width: '60px', textAlign: 'right' }}>${parseFloat(item.precio_unitario).toFixed(2)}</span>
                  <span style={{ width: '70px', textAlign: 'right' }}>${(item.cantidad * item.precio_unitario).toFixed(2)}</span>
                </div>
              ))}
              
              {printData.extraServices > 0 && (
                <div style={{ display: 'flex', marginTop: '4px' }}>
                  <span style={{ width: '40px' }}>1</span>
                  <span style={{ flex: '1' }}>Servicios Adicionales (Alineación/Balanceo/Etc)</span>
                  <span style={{ width: '60px', textAlign: 'right' }}>${printData.extraServices.toFixed(2)}</span>
                  <span style={{ width: '70px', textAlign: 'right' }}>${printData.extraServices.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #111111', paddingTop: '8px', paddingBottom: '8px', borderBottom: '1px dashed #111111', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ width: '180px', display: 'flex', justifyContent: 'space-between' }}>
                <span>SUBTOTAL:</span>
                <span>${(printData.total / 1.16).toFixed(2)}</span>
              </div>
              <div style={{ width: '180px', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span>IVA (16%):</span>
                <span>${(printData.total - (printData.total / 1.16)).toFixed(2)}</span>
              </div>
              <div style={{ width: '180px', display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                <span>TOTAL NETO:</span>
                <span>${parseFloat(printData.total).toFixed(2)} MXN</span>
              </div>
            </div>
            
            <div style={{ paddingBottom: '8px', marginBottom: '8px', marginTop: '8px' }}>
              <p style={{ margin: '2px 0' }}><strong>ATENDIÓ:</strong> {printData.vendedor}</p>
            </div>

            <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px dashed #111111', paddingTop: '10px', fontSize: '9px' }}>
              <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>TÉRMINOS DE GARANTÍA</p>
              <p style={{ margin: '0', color: '#555555' }}>
                Garantía de 1 año contra defectos de fábrica en llantas nuevas. 
                Los servicios de alineación tienen 30 días de garantía. 
                Conserve este ticket para cualquier aclaración o reclamación futura.
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
