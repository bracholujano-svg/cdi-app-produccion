import React, { useState, useMemo } from 'react';
import { Activity, Clock, Search, TrendingDown, TrendingUp, X, Filter, BarChart3, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export default function DossierDashboard() {
  const { orders, setShowDossierModal } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPedido, setSelectedPedido] = useState(null);

  // Agrupar órdenes por pedido para la vista general
  const groupedOrders = useMemo(() => {
    const grouped = {};
    orders.forEach(o => {
      const pNum = o.pedidoNum || "S/N";
      if (!grouped[pNum]) {
        grouped[pNum] = {
          pedidoNum: pNum,
          cliente: o.cliente,
          products: []
        };
      }
      grouped[pNum].products.push(o);
    });
    return Object.values(grouped).sort((a,b) => String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, {numeric:true}));
  }, [orders]);

  // Filtrar pedidos
  const filteredPedidos = useMemo(() => {
    if (!searchTerm) return groupedOrders;
    const st = searchTerm.toLowerCase();
    return groupedOrders.filter(g => 
      g.pedidoNum.toLowerCase().includes(st) || 
      (g.cliente || "").toLowerCase().includes(st)
    );
  }, [groupedOrders, searchTerm]);

  // Función para calcular tiempos de un producto específico
  const calculateProductTimes = (product) => {
    if (!product.historial || product.historial.length === 0) return { working: 0, waiting: 0, details: [] };
    
    // Sort chronological
    const history = [...product.historial].sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    
    let totalWorking = 0; // ms
    let totalWaiting = 0; // ms
    const details = [];

    let currentAreaStartTime = null;
    let currentArea = null;
    let transferStartTime = null;
    
    history.forEach((h, index) => {
      const isReception = h.accion && h.accion.toUpperCase().includes('RECEPCIÓN');
      const isTransfer = h.accion && h.accion.toUpperCase().includes('TRANSFERENCIA');
      const isInitial = h.accion && h.accion.toUpperCase().includes('ASIGNACIÓN INICIAL');
      const time = new Date(h.fecha).getTime();

      if (isInitial || isReception) {
        // Fin de una espera (si venía de transferencia)
        if (transferStartTime) {
          const waitTime = time - transferStartTime;
          totalWaiting += waitTime;
          details.push({ type: 'wait', from: currentArea, to: h.area, duration: waitTime });
          transferStartTime = null;
        }
        // Inicia trabajo en esta área
        currentAreaStartTime = time;
        currentArea = h.area;
      } else if (isTransfer) {
        // Termina trabajo en el área actual
        if (currentAreaStartTime) {
          const workTime = time - currentAreaStartTime;
          totalWorking += workTime;
          details.push({ type: 'work', area: currentArea, duration: workTime });
          currentAreaStartTime = null;
        }
        // Inicia tiempo de espera (hasta ser recibido)
        transferStartTime = time;
      } else {
         // Otros eventos intermedios (como avances, bifurcaciones) pueden contar como trabajo continuo
         // si no resetean el area, pero solo tomamos el tiempo en base a los extremos.
      }
    });

    // Si sigue trabajando en un área
    if (currentAreaStartTime) {
       const workTime = Date.now() - currentAreaStartTime;
       totalWorking += workTime;
       details.push({ type: 'work_active', area: currentArea, duration: workTime });
    }

    // Si sigue en transferencia
    if (transferStartTime) {
       const waitTime = Date.now() - transferStartTime;
       totalWaiting += waitTime;
       details.push({ type: 'wait_active', from: currentArea, duration: waitTime });
    }

    return { working: totalWorking, waiting: totalWaiting, details };
  };

  const msToHours = (ms) => (ms / (1000 * 60 * 60)).toFixed(2);
  const msToDaysStr = (ms) => {
      const d = Math.floor(ms / (1000 * 60 * 60 * 24));
      const h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return `${d}d ${h}h`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
      <div className="bg-[var(--bg-main)] w-full h-full md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
        {/* Header */}
        <div className="p-4 md:p-6 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl">
               <Activity size={28} />
             </div>
             <div>
               <h2 className="text-xl md:text-2xl font-black text-[var(--primary)] uppercase tracking-tight">DOSSIER DE PRODUCCIÓN</h2>
               <p className="text-xs md:text-sm font-bold theme-text-muted">Análisis de Tiempos Muertos y Eficiencia</p>
             </div>
          </div>
          <button onClick={() => setShowDossierModal(false)} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-[var(--primary)]">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* Sidebar / Lista de Pedidos */}
          <div className={`w-full md:w-[350px] lg:w-[400px] border-r theme-border bg-[var(--card-bg)] flex flex-col shrink-0 transition-transform ${selectedPedido ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b theme-border">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar pedido o cliente..." 
                    className="w-full pl-10 pr-4 py-3 bg-[var(--bg-input)] border theme-border rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500 text-[var(--primary)]"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
               {filteredPedidos.map(g => (
                 <div 
                   key={g.pedidoNum}
                   onClick={() => setSelectedPedido(g)}
                   className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedPedido?.pedidoNum === g.pedidoNum ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-400' : 'theme-bg-card theme-border hover:border-purple-500/50 hover:-translate-y-1'}`}
                 >
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-black text-lg">#{g.pedidoNum}</h3>
                       <span className="text-xs font-bold px-2 py-1 bg-black/5 dark:bg-white/5 rounded-md">{g.products.length} PRODS</span>
                    </div>
                    <p className="text-sm font-bold opacity-80 truncate">{g.cliente || 'Sin cliente'}</p>
                 </div>
               ))}
               {filteredPedidos.length === 0 && (
                 <div className="p-8 text-center text-slate-500 font-bold">
                   No se encontraron pedidos.
                 </div>
               )}
            </div>
          </div>

          {/* Área Principal / Detalles del Pedido */}
          <div className={`flex-1 flex flex-col bg-[var(--bg-main)] ${!selectedPedido ? 'hidden md:flex items-center justify-center' : ''}`}>
             {!selectedPedido ? (
               <div className="text-center opacity-40">
                 <BarChart3 size={64} className="mx-auto mb-4" />
                 <h2 className="text-xl font-black uppercase tracking-widest">Seleccione un Pedido</h2>
               </div>
             ) : (
               <div className="flex-1 overflow-y-auto custom-scrollbar h-full">
                  <div className="p-4 md:p-8 space-y-8">
                     
                     {/* Botón Volver (Solo Móvil) */}
                     <button onClick={() => setSelectedPedido(null)} className="md:hidden flex items-center gap-2 text-purple-500 font-bold mb-4">
                        <X size={18} /> Volver a la lista
                     </button>

                     {/* Cabecera del Pedido */}
                     <div className="flex justify-between items-end pb-4 border-b theme-border">
                        <div>
                          <p className="text-sm font-black text-purple-500 tracking-widest uppercase mb-1">Análisis Detallado</p>
                          <h2 className="text-3xl md:text-5xl font-black uppercase text-[var(--primary)]">PEDIDO #{selectedPedido.pedidoNum}</h2>
                          <p className="text-lg font-bold theme-text-muted mt-2">{selectedPedido.cliente}</p>
                        </div>
                     </div>

                     {/* Productos y sus Tiempos */}
                     <div className="space-y-6">
                        <h3 className="text-xl font-black uppercase flex items-center gap-2"><Clock /> Tiempos por Producto</h3>
                        
                        {selectedPedido.products.map(p => {
                           const times = calculateProductTimes(p);
                           const total = times.working + times.waiting;
                           const workingPercent = total > 0 ? (times.working / total) * 100 : 0;
                           const waitingPercent = total > 0 ? (times.waiting / total) * 100 : 0;
                           const hasWaitAlert = waitingPercent > 30; // Alerta si más del 30% del tiempo es muerto

                           return (
                             <div key={p.id} className="theme-bg-card rounded-2xl border theme-border overflow-hidden">
                                <div className="p-4 border-b theme-border flex flex-wrap gap-4 justify-between items-center bg-black/5 dark:bg-white/5">
                                   <div>
                                     <h4 className="font-black text-lg text-[var(--primary)]">{p.nombre}</h4>
                                     <p className="text-xs font-bold theme-text-muted">Cód: {p.codArticulo}</p>
                                   </div>
                                   <div className="flex gap-4">
                                      <div className="text-right">
                                        <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">T. Procesado</p>
                                        <p className="font-black text-lg">{msToDaysStr(times.working)}</p>
                                      </div>
                                      <div className="text-right border-l theme-border pl-4">
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${hasWaitAlert ? 'text-red-500' : 'text-orange-500'}`}>T. Muerto (Espera)</p>
                                        <p className="font-black text-lg">{msToDaysStr(times.waiting)}</p>
                                      </div>
                                   </div>
                                </div>
                                <div className="p-4 space-y-4">
                                   {/* Barra visual */}
                                   {total > 0 && (
                                     <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                                        <div style={{width: `${workingPercent}%`}} className="bg-emerald-500 h-full" title={`Procesado: ${workingPercent.toFixed(1)}%`}></div>
                                        <div style={{width: `${waitingPercent}%`}} className="bg-red-500 h-full" title={`Espera: ${waitingPercent.toFixed(1)}%`}></div>
                                     </div>
                                   )}
                                   {hasWaitAlert && (
                                      <p className="text-xs font-black text-red-500 uppercase flex items-center gap-1"><AlertTriangle size={14}/> Este producto tiene un alto índice de tiempo de espera.</p>
                                   )}
                                   
                                   {/* Detalles del Historial */}
                                   {times.details.length > 0 && (
                                      <div className="mt-4 border-t theme-border pt-4">
                                         <p className="text-[10px] font-black uppercase theme-text-muted mb-2 tracking-widest">Desglose de Áreas y Esperas</p>
                                         <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                            {times.details.map((d, i) => (
                                               <div key={i} className={`shrink-0 px-3 py-2 border rounded-xl flex flex-col min-w-[120px] ${d.type.includes('wait') ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
                                                  <span className="text-[10px] font-black uppercase tracking-wider">{d.type.includes('wait') ? 'ESPERA TRAS ' + d.from : d.area}</span>
                                                  <span className="text-sm font-black">{msToHours(d.duration)}h</span>
                                               </div>
                                            ))}
                                         </div>
                                      </div>
                                   )}
                                </div>
                             </div>
                           );
                        })}
                     </div>
                  </div>
               </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
}
