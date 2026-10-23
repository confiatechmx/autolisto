'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ConcurrencyService } from '@/services/concurrencyService';
import { 
  Package, 
  Layers, 
  AlertTriangle, 
  TrendingUp, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Edit, 
  ArrowUpCircle,
  X,
  Loader2,
  Check
} from 'lucide-react';

export interface Tire {
  id: string;
  marca: string;
  modelo_llanta: string;
  ancho: number;
  perfil: number;
  rin: number;
  indice_carga_velocidad: string;
  tipo_terreno: 'AT' | 'MT' | 'HT' | 'All Season' | 'Passenger' | string;
  stock_actual: number;
  stock_minimo: number;
  precio_venta: number;
  costo_adquisicion: number;
}

export default function InventarioDashboard() {
  const [tires, setTires] = useState<Tire[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [terrainFilter, setTerrainFilter] = useState('Todos');
  const [rinFilter, setRinFilter] = useState('Todos');

  // Modal States
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);

  // Selected Tire for edit/stock update
  const [selectedTire, setSelectedTire] = useState<Tire | null>(null);

  // Form states
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    marca: '',
    modelo_llanta: '',
    ancho: 205,
    perfil: 55,
    rin: 16,
    indice_carga_velocidad: '91V',
    tipo_terreno: 'HT',
    stock_actual: 4,
    stock_minimo: 4,
    precio_venta: 2000,
    costo_adquisicion: 1400
  });

  const [quickStockAmount, setQuickStockAmount] = useState<number>(4);

  // Fetch Inventory from Supabase
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventario_llantas')
        .select('*')
        .order('marca', { ascending: true })
        .order('modelo_llanta', { ascending: true });

      if (error) throw error;
      setTires(data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Financial calculations for Bento stats
  const totalStock = tires.reduce((acc, curr) => acc + curr.stock_actual, 0);
  const uniqueModels = tires.length;
  const criticalItems = tires.filter(t => t.stock_actual <= t.stock_minimo).length;
  
  const totalAdquisitionValue = tires.reduce((acc, curr) => acc + (curr.stock_actual * curr.costo_adquisicion), 0);
  const totalEstimatedSaleValue = tires.reduce((acc, curr) => acc + (curr.stock_actual * curr.precio_venta), 0);
  const estimatedGrossProfit = totalEstimatedSaleValue - totalAdquisitionValue;
  const avgMargin = totalEstimatedSaleValue > 0 
    ? (estimatedGrossProfit / totalEstimatedSaleValue) * 100 
    : 0;

  // Filtered List
  const filteredTires = tires.filter(t => {
    const matchesSearch = 
      t.marca.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.modelo_llanta.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${t.ancho}/${t.perfil}R${t.rin}`.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesTerrain = terrainFilter === 'Todos' || t.tipo_terreno === terrainFilter;
    const matchesRin = rinFilter === 'Todos' || t.rin.toString() === rinFilter;

    return matchesSearch && matchesTerrain && matchesRin;
  });

  // Unique Rins for filter dropdown
  const uniqueRins = Array.from(new Set(tires.map(t => t.rin))).sort((a, b) => a - b);

  // Initialize new form
  const handleOpenNewModal = () => {
    setFormData({
      marca: '',
      modelo_llanta: '',
      ancho: 205,
      perfil: 55,
      rin: 16,
      indice_carga_velocidad: '91V',
      tipo_terreno: 'HT',
      stock_actual: 4,
      stock_minimo: 4,
      precio_venta: 2000,
      costo_adquisicion: 1400
    });
    setIsNewModalOpen(true);
  };

  // Initialize edit form
  const handleOpenEditModal = (tire: Tire) => {
    setSelectedTire(tire);
    setFormData({
      marca: tire.marca,
      modelo_llanta: tire.modelo_llanta,
      ancho: tire.ancho,
      perfil: tire.perfil,
      rin: tire.rin,
      indice_carga_velocidad: tire.indice_carga_velocidad,
      tipo_terreno: tire.tipo_terreno,
      stock_actual: tire.stock_actual,
      stock_minimo: tire.stock_minimo,
      precio_venta: tire.precio_venta,
      costo_adquisicion: tire.costo_adquisicion
    });
    setIsEditModalOpen(true);
  };

  // Initialize stock modal
  const handleOpenStockModal = (tire: Tire) => {
    setSelectedTire(tire);
    setQuickStockAmount(4);
    setIsStockModalOpen(true);
  };

  // Submit new tire
  const handleCreateTire = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const { error } = await supabase
        .from('inventario_llantas')
        .insert([formData]);

      if (error) throw error;
      
      setIsNewModalOpen(false);
      await fetchInventory();
    } catch (err) {
      console.error('Error creating tire:', err);
      alert('Error al registrar neumático en Supabase');
    } finally {
      setFormLoading(false);
    }
  };

  // Submit edit tire
  const handleEditTire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTire) return;
    setFormLoading(true);
    try {
      const { error } = await supabase
        .from('inventario_llantas')
        .update(formData)
        .eq('id', selectedTire.id);

      if (error) throw error;
      
      setIsEditModalOpen(false);
      await fetchInventory();
    } catch (err) {
      console.error('Error editing tire:', err);
      alert('Error al actualizar neumático');
    } finally {
      setFormLoading(false);
    }
  };

  // Quick stock entry add with atomic locking
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTire) return;
    setFormLoading(true);
    try {
      const res = await ConcurrencyService.ajustarStock({
        llantaId: selectedTire.id,
        delta: quickStockAmount,
        permitirNegativo: false,
      });

      if (!res.success) {
        alert(res.message || 'Error al actualizar existencia con bloqueo pesimista');
        return;
      }

      setIsStockModalOpen(false);
      await fetchInventory();
    } catch (err: any) {
      console.error('Error updating stock:', err);
      alert('Error al actualizar existencia: ' + (err?.message || 'Error desconocido'));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 flex-1">
      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Stock Total */}
        <div className="bg-card p-4 rounded-xl flex items-center justify-between shadow-sm border border-slate-200">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-semibold">
              Stock Total
            </span>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight tabular-nums">
              {totalStock.toLocaleString()} <span className="text-xs font-semibold text-slate-400">pzas</span>
            </h3>
            <p className="text-[9px] text-slate-500/70 mt-1 font-mono">
              Existencia global en patio
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Package className="w-5 h-5 text-primary" />
          </div>
        </div>

        {/* Card 2: Modelos Únicos */}
        <div className="bg-card p-4 rounded-xl flex items-center justify-between shadow-sm border border-slate-200">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-semibold">
              Modelos Únicos
            </span>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight tabular-nums">
              {uniqueModels} <span className="text-xs font-semibold text-slate-400">medidas</span>
            </h3>
            <p className="text-[9px] text-slate-500/70 mt-1 font-mono">
              Registros en catálogo
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Layers className="w-5 h-5 text-slate-600" />
          </div>
        </div>

        {/* Card 3: Alertas Críticas */}
        <div className="bg-card p-4 rounded-xl flex items-center justify-between shadow-sm border border-slate-200">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-semibold">
              Stock Crítico
            </span>
            <h3 className={`text-2xl font-extrabold mt-1 tracking-tight tabular-nums ${criticalItems > 0 ? 'text-destructive' : 'text-slate-900'}`}>
              {criticalItems} <span className="text-xs font-semibold text-slate-400">alertas</span>
            </h3>
            <p className="text-[9px] text-slate-500/70 mt-1 font-mono">
              Igual o menor al stock mínimo
            </p>
          </div>
          <div className={`p-3 border rounded-lg ${criticalItems > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <AlertTriangle className={`w-5 h-5 ${criticalItems > 0 ? 'text-destructive' : 'text-slate-500'}`} />
          </div>
        </div>

        {/* Card 4: Valorización */}
        <div className="bg-card p-4 rounded-xl flex items-center justify-between shadow-sm border border-slate-200">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-semibold">
              Valorización Activos (Costo)
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 mt-1.5 tracking-tight font-mono tabular-nums">
              ${totalAdquisitionValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[9px] text-slate-500/70 mt-1 font-mono flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-success" />
              <span>Margen Promedio: <strong className="tabular-nums">{avgMargin.toFixed(1)}%</strong></span>
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-card rounded-xl p-5 flex flex-col shadow-sm border border-slate-200">
        {/* Controls: Search, Filters, Add New */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 mb-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por marca, modelo o rin (ej. Michelin, 205)..."
                className="w-full bg-white border border-slate-300 rounded-md pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-sans shadow-sm transition-all"
              />
            </div>

            {/* Terrain Filter */}
            <div className="relative flex-shrink-0">
              <select
                value={terrainFilter}
                onChange={(e) => setTerrainFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer pr-8 font-sans shadow-sm transition-all"
              >
                <option value="Todos">Terreno: Todos</option>
                <option value="HT">Highway Terrain (HT)</option>
                <option value="AT">All Terrain (AT)</option>
                <option value="MT">Mud Terrain (MT)</option>
                <option value="All Season">All Season</option>
                <option value="Passenger">Passenger</option>
              </select>
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Rin Filter */}
            <div className="relative flex-shrink-0">
              <select
                value={rinFilter}
                onChange={(e) => setRinFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer pr-8 font-sans shadow-sm transition-all"
              >
                <option value="Todos">Rin: Todos</option>
                {uniqueRins.map(r => (
                  <option key={r} value={r.toString()}>Rin {r}"</option>
                ))}
              </select>
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Add New Tire Button */}
          <button
            onClick={handleOpenNewModal}
            className="text-sm bg-primary text-white font-semibold shadow-sm hover:bg-primary/90 px-4 py-2 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Registrar Neumático</span>
          </button>
        </div>

        {/* High Density Table */}
        <div className="overflow-x-auto dense-scrollbar border border-slate-200 rounded-lg bg-white shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 animate-pulse font-medium">
              Cargando catálogo de llantas...
            </div>
          ) : filteredTires.length === 0 ? (
            <div className="py-16 text-center text-sm font-semibold text-slate-500 p-4">
              No se encontraron neumáticos con los filtros seleccionados
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider select-none">
                  <th className="py-3 px-4 font-semibold">Producto</th>
                  <th className="py-3 px-3 font-semibold">Medida</th>
                  <th className="py-3 px-3 font-semibold text-center">Terreno</th>
                  <th className="py-3 px-3 font-semibold text-right">Costo</th>
                  <th className="py-3 px-3 font-semibold text-right">Precio Venta</th>
                  <th className="py-3 px-3 font-semibold text-center">Margen</th>
                  <th className="py-3 px-4 font-semibold text-center">Stock / Mínimo</th>
                  <th className="py-3 px-4 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTires.map((tire) => {
                  const isCritical = tire.stock_actual <= tire.stock_minimo;
                  const grossProfit = tire.precio_venta - tire.costo_adquisicion;
                  const marginPct = tire.precio_venta > 0 ? (grossProfit / tire.precio_venta) * 100 : 0;

                  return (
                    <tr 
                      key={tire.id} 
                      className={`hover:bg-slate-50 transition-colors group cursor-pointer`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{tire.marca}</div>
                        <div className="text-xs text-slate-500">{tire.modelo_llanta}</div>
                      </td>
                      <td className="py-3 px-3 tabular-nums font-semibold text-slate-900">
                        {tire.ancho}/{tire.perfil} R{tire.rin} <span className="text-xs text-slate-400 font-normal">{tire.indice_carga_velocidad}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                          {tire.tipo_terreno}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-600 font-medium">
                        ${tire.costo_adquisicion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-900">
                        ${tire.precio_venta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center tabular-nums">
                        <span className={`font-semibold ${marginPct >= 30 ? 'text-success' : 'text-slate-600'}`}>
                          {marginPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 tabular-nums">
                          {isCritical ? (
                            <span className="bg-red-50 text-destructive border border-red-200 rounded-full px-2.5 py-0.5 text-xs font-bold inline-block shadow-sm">
                              {tire.stock_actual}
                            </span>
                          ) : (
                            <span className="text-slate-700 font-bold px-2.5 py-0.5">
                              {tire.stock_actual}
                            </span>
                          )}
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-500 font-medium">{tire.stock_minimo}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenStockModal(tire)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                            title="Registrar Entrada de Llantas"
                          >
                            <ArrowUpCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(tire)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                            title="Editar Parámetros"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Registrar entrada de llantas (Quick Stock Update) */}
      {isStockModalOpen && selectedTire && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-slate-200 rounded-xl w-full max-w-sm p-6 shadow-lg relative animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-4">
            <button 
              onClick={() => setIsStockModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-sans">
                Registrar Entrada
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Añadir existencias para {selectedTire.marca} {selectedTire.modelo_llanta} (<span className="tabular-nums">{selectedTire.ancho}/{selectedTire.perfil} R{selectedTire.rin}</span>)
              </p>
            </div>

            <form onSubmit={handleAddStock} className="flex flex-col gap-5">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-sans">
                <span className="text-slate-600 font-semibold">Existencia Actual:</span>
                <span className="font-bold text-slate-900 tabular-nums">{selectedTire.stock_actual} piezas</span>
              </div>

              <div className="relative">
                <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                  Cantidad a ingresar (piezas)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={quickStockAmount}
                  onChange={(e) => setQuickStockAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shadow-sm transition-all"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="flex-1 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-md cursor-pointer transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-sm rounded-md cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  {formLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 text-white" />
                  )}
                  <span>Registrar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Nueva Llanta / Editar Llanta */}
      {(isNewModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-slate-200 rounded-xl w-full max-w-xl p-6 shadow-lg relative animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-5">
            <button 
              onClick={() => {
                setIsNewModalOpen(false);
                setIsEditModalOpen(false);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-sans">
                {isNewModalOpen ? 'Registrar Neumático en Catálogo' : 'Editar Propiedades del Neumático'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isNewModalOpen ? 'Llene los campos para ingresar un nuevo modelo al inventario' : 'Modifique los campos y salve para actualizar la base de datos'}
              </p>
            </div>

            <form onSubmit={isNewModalOpen ? handleCreateTire : handleEditTire} className="flex flex-col gap-4">
              {/* Row 1: Brand & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Marca
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.marca}
                    onChange={(e) => setFormData(prev => ({ ...prev, marca: e.target.value }))}
                    placeholder="Ej. Michelin"
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-sm transition-all"
                  />
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Modelo de Llanta
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.modelo_llanta}
                    onChange={(e) => setFormData(prev => ({ ...prev, modelo_llanta: e.target.value }))}
                    placeholder="Ej. Primacy 4"
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-sm transition-all"
                  />
                </div>
              </div>

              {/* Row 2: Specifications (Ancho, Perfil, Rin, Indice) */}
              <div className="grid grid-cols-4 gap-3">
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Ancho
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.ancho}
                    onChange={(e) => setFormData(prev => ({ ...prev, ancho: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shadow-sm transition-all"
                  />
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Perfil
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.perfil}
                    onChange={(e) => setFormData(prev => ({ ...prev, perfil: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shadow-sm transition-all"
                  />
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Rin
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.rin}
                    onChange={(e) => setFormData(prev => ({ ...prev, rin: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shadow-sm transition-all"
                  />
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Índice C/V
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.indice_carga_velocidad}
                    onChange={(e) => setFormData(prev => ({ ...prev, indice_carga_velocidad: e.target.value }))}
                    placeholder="91H"
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shadow-sm transition-all"
                  />
                </div>
              </div>

              {/* Row 3: Terrain, Stock Actual, Stock Mínimo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Tipo Terreno
                  </label>
                  <select
                    value={formData.tipo_terreno}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipo_terreno: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer pr-8 shadow-sm transition-all"
                  >
                    <option value="HT">HT - Highway</option>
                    <option value="AT">AT - All Terrain</option>
                    <option value="MT">MT - Mud Terrain</option>
                    <option value="All Season">All Season</option>
                    <option value="Passenger">Passenger</option>
                  </select>
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Stock Actual
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.stock_actual}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_actual: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shadow-sm transition-all"
                  />
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.stock_minimo}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_minimo: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shadow-sm transition-all"
                  />
                </div>
              </div>

              {/* Row 4: Costo de Adquisición & Precio de Venta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Costo de Adquisición ($)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={formData.costo_adquisicion}
                    onChange={(e) => setFormData(prev => ({ ...prev, costo_adquisicion: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shadow-sm transition-all"
                  />
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Precio de Venta ($)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={formData.precio_venta}
                    onChange={(e) => setFormData(prev => ({ ...prev, precio_venta: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-white border border-slate-300 rounded-md pt-5 pb-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shadow-sm transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-md cursor-pointer transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-sm rounded-md cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  {formLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 text-white" />
                  )}
                  <span>{isNewModalOpen ? 'Guardar Modelo' : 'Actualizar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
