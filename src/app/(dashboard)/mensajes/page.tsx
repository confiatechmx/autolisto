"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Search, Send, MessageSquare, Plus, User, MoreVertical, Phone, Loader2, Globe, Camera } from "lucide-react";
import { supabase } from "../../../lib/supabase";

interface ChatSession {
  id: string;
  cliente_id: string | null;
  canal: 'WhatsApp_Baileys' | 'WhatsApp_Cloud' | 'Facebook' | 'Instagram' | 'TikTok';
  estado: string;
  creado_en: string;
  cliente?: { nombre: string; telefono: string };
}

interface ChatMessage {
  id: string;
  sentido: 'Entrante' | 'Saliente';
  contenido: string;
  creado_en: string;
}

export default function MensajesInboxPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Opportunity Modal State
  const [isOppModalOpen, setIsOppModalOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [oppAmount, setOppAmount] = useState("");
  const [oppName, setOppName] = useState("");
  const [oppPhone, setOppPhone] = useState("");
  
  // Extended Fields
  const [oppEmpresa, setOppEmpresa] = useState("");
  const [oppFuente, setOppFuente] = useState("Facebook");
  const [oppNotas, setOppNotas] = useState("");

  async function loadSessions() {
    setLoading(true);
    const { data } = await supabase
      .from('conversaciones_omnicanal')
      .select('*, cliente:clientes(nombre, telefono)')
      .order('ultimo_mensaje_at', { ascending: false });
    
    if (data) {
      setSessions(data as any);
    }
    setLoading(false);
  }

  async function loadMessages(sessionId: string) {
    const { data } = await supabase
      .from('mensajes_omnicanal')
      .select('*')
      .eq('conversacion_id', sessionId)
      .order('creado_en', { ascending: true });
    
    if (data) setMessages(data as any);
  }

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession.id);
    } else {
      setMessages([]);
    }
  }, [activeSession]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeSession) return;

    const tempMessage = {
      id: Date.now().toString(),
      sentido: 'Saliente' as const,
      contenido: newMessage,
      creado_en: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage("");

    await supabase.from('mensajes_omnicanal').insert({
      conversacion_id: activeSession.id,
      sentido: 'Saliente',
      contenido: tempMessage.contenido
    });
    
    // Update last message timestamp
    await supabase.from('conversaciones_omnicanal').update({ ultimo_mensaje_at: new Date().toISOString() }).eq('id', activeSession.id);
    
    // Refresh to get actual UUID and timestamp
    loadMessages(activeSession.id);
  };

  const simulateIncomingLead = async () => {
    const { data: convData, error: convErr } = await supabase.from('conversaciones_omnicanal').insert({
      canal: 'Facebook',
      estado: 'Abierto',
      identificador_externo: 'simulado_fb_' + Date.now()
    }).select().single();

    if (!convErr && convData) {
      await supabase.from('mensajes_omnicanal').insert({
        conversacion_id: convData.id,
        sentido: 'Entrante',
        contenido: "¡Hola! Vi su anuncio en Facebook. ¿Cuánto cobran por cambiar balatas de un Versa 2018?"
      });
      loadSessions();
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'Facebook': return <Globe size={14} className="text-blue-600" />;
      case 'Instagram': return <Camera size={14} className="text-pink-600" />;
      default: return <MessageSquare size={14} className="text-green-500" />; // whatsapp
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    
    let clientId = activeSession.cliente_id;
    
    // Si no tiene cliente, lo creamos primero
    if (!clientId) {
      if (!oppName.trim() || !oppPhone.trim()) {
        alert("Debes ingresar nombre y teléfono para registrar a este nuevo prospecto como cliente.");
        return;
      }
      const { data: newClient, error: clientErr } = await supabase.from('clientes').insert({
        nombre: oppName,
        telefono: oppPhone,
        correo: '',
        empresa: oppEmpresa || null,
        fuente_adquisicion: oppFuente,
        notas_internas: oppNotas || null,
        tags: ['Lead Digital']
      }).select().single();
      
      if (newClient) {
        clientId = newClient.id;
        // Vincular conversacion al nuevo cliente
        await supabase.from('conversaciones_omnicanal').update({ cliente_id: clientId }).eq('id', activeSession.id);
      } else {
        alert("Error creando cliente");
        return;
      }
    }
    
    // Crear oportunidad
    const { error: oppErr } = await supabase.from('oportunidades_venta').insert({
      cliente_id: clientId,
      monto_estimado: Number(oppAmount) || 0,
      estado: 'nuevo'
    });
    
    if (!oppErr) {
      setIsOppModalOpen(false);
      setIsAdvancedOpen(false);
      setOppAmount("");
      setOppName("");
      setOppPhone("");
      setOppEmpresa("");
      setOppFuente("Facebook");
      setOppNotas("");
      loadSessions(); // recargar para ver el cliente vinculado
      toast.success("¡Oportunidad de venta creada exitosamente y mandada al Pipeline!");
    } else {
      toast.error("Error al crear la oportunidad");
    }
  };

  return (
    <div className="h-full flex flex-col relative animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 sm:gap-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inbox Omnicanal</h1>
          <p className="text-sm font-light text-slate-500 mt-1">Centraliza tus mensajes de WhatsApp y Redes Sociales.</p>
        </div>
        <button 
          onClick={simulateIncomingLead}
          className="bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto"
        >
          <Globe size={14} />
          Simular Lead de Facebook
        </button>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex overflow-hidden">
        
        {/* Left Panel: Chat List */}
        <div className={`w-full md:w-80 border-r border-slate-200 flex-col bg-slate-50/50 shrink-0 ${activeSession ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar chats..." 
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" /> Cargando...</div>
            ) : sessions.length > 0 ? (
              sessions.map(session => (
                <div 
                  key={session.id}
                  onClick={() => setActiveSession(session)}
                  className={`p-4 border-b border-slate-100 cursor-pointer transition-colors flex flex-col gap-1 ${activeSession?.id === session.id ? 'bg-blue-50/60 border-l-4 border-l-blue-500' : 'hover:bg-white border-l-4 border-l-transparent'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {session.cliente?.nombre || 'Prospecto Web'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(session.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(session.canal)}
                    <span className="text-xs text-slate-500 truncate">
                      {session.cliente?.telefono || 'Nuevo mensaje'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <MessageSquare size={32} className="text-zinc-200 mb-3" />
                <p className="text-xs text-slate-400 font-medium">No hay mensajes recientes</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Chat Window */}
        <div className={`flex-1 flex-col bg-[#f0f2f5] relative ${!activeSession ? 'hidden md:flex' : 'flex'}`}>
          {activeSession ? (
            <>
              {/* Chat Header */}
              <div className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 md:gap-3">
                  <button onClick={() => setActiveSession(null)} className="md:hidden p-2 -ml-2 text-slate-500 hover:text-zinc-700">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                    <User size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-sm">
                      {activeSession.cliente?.nombre || 'Prospecto (Sin Registrar)'}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                      {getPlatformIcon(activeSession.canal)}
                      <span className="capitalize">{activeSession.canal.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setOppName(activeSession.cliente?.nombre || "");
                      setOppPhone(activeSession.cliente?.telefono || "");
                      setIsOppModalOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Crear Oportunidad
                  </button>
                  <button className="p-2 text-slate-400 hover:text-zinc-700 transition-colors">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                <div className="text-center mb-6">
                  <span className="bg-white/80 backdrop-blur border border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Hoy
                  </span>
                </div>
                {messages.map((msg) => {
                  const isUser = msg.sentido === 'Saliente';
                  return (
                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                        isUser 
                          ? 'bg-blue-600 text-white rounded-br-sm' 
                          : 'bg-white border border-slate-200 text-zinc-800 rounded-bl-sm'
                      }`}>
                        <p className="leading-relaxed">{msg.contenido}</p>
                        <div className={`text-[9px] font-medium mt-1 text-right ${isUser ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(msg.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-[#f0f2f5]">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                  <button type="button" className="p-2 text-slate-400 hover:text-zinc-700 transition-colors">
                    <Plus size={20} />
                  </button>
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm text-zinc-800 placeholder-zinc-400 px-2"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={16} className="ml-0.5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50">
              <div className="w-24 h-24 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm mb-4">
                <MessageSquare size={32} className="text-zinc-300" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Bandeja de Entrada</h2>
              <p className="text-sm text-slate-500 mt-2 max-w-sm text-center">Selecciona una conversación de la izquierda para comenzar a chatear o crear una oportunidad de venta.</p>
            </div>
          )}
        </div>

      </div>

      {/* Modal Crear Oportunidad */}
      {isOppModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Convertir en Oportunidad</h2>
            <p className="text-sm text-slate-500 mb-6">Manda este prospecto directo a tu Pipeline de Ventas.</p>
            
            <form onSubmit={handleCreateOpportunity} className="flex flex-col gap-4">
              
              {!activeSession.cliente_id && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-2">
                  <p className="text-xs text-blue-700 font-medium mb-3">Este contacto no está registrado. Completa sus datos para añadirlo a tu directorio.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wider">Nombre</label>
                      <input required type="text" value={oppName} onChange={e => setOppName(e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="Ej. Juan Pérez" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wider">Teléfono</label>
                      <input required type="tel" value={oppPhone} onChange={e => setOppPhone(e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="Ej. 5512345678" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <button 
                      type="button" 
                      onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {isAdvancedOpen ? "- Ocultar Datos Avanzados" : "+ Mostrar Datos Avanzados (Opcional)"}
                    </button>
                  </div>

                  {isAdvancedOpen && (
                    <div className="mt-3 pt-3 border-t border-blue-200/50 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wider">Empresa (Flotilla)</label>
                        <input type="text" value={oppEmpresa} onChange={e => setOppEmpresa(e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="Ej. Bimbo" />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wider">Fuente</label>
                        <select value={oppFuente} onChange={e => setOppFuente(e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                          <option value="Facebook">Facebook</option>
                          <option value="Instagram">Instagram</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Google">Google Ads</option>
                          <option value="Referido">Referido</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wider">Notas Internas</label>
                        <input type="text" value={oppNotas} onChange={e => setOppNotas(e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="Ej. Cliente pide factura..." />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wider">Monto Estimado de Venta ($)</label>
                <input 
                  type="number" 
                  value={oppAmount} 
                  onChange={e => setOppAmount(e.target.value)} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-zinc-500" 
                  placeholder="0.00" 
                  required
                />
              </div>
              
              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsOppModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-bold text-zinc-600 bg-slate-100 hover:bg-zinc-200 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
                  Crear Oportunidad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
