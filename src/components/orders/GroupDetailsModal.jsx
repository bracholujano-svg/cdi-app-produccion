import React, { useEffect, useMemo } from 'react';
import { Search, MapPin, Clock, Camera, ImageIcon, Mic, MicOff, History, ChevronUp, ChevronDown, UserCheck, ArrowRightLeft, MessageSquare, Download, AlertCircle, CheckCircle, Package, FileText, CheckSquare, Square, Zap } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';
import { CONFIG_PROCESOS, AREAS_RECEPCION } from '../../utils/constants';

const GroupDetailsModal = ({ activeGroupObj, handleImageUpload, addShiftNote, toggleMic }) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const { orders, setShowDashboardModal, setSelectedGroupPedido, setSelectedOrder, selectedBulkOrders, setSelectedBulkOrders, setShowBulkModal, tempOperario, setTempOperario, tempShiftActivity, setTempShiftActivity, shiftNoteText, setShiftNoteText, tempPhoto, setTempPhoto, isListening, activeDictationTarget } = useAppContext();
  const { itemSearchTerm, setItemSearchTerm } = useAppStore();
  
  useEffect(() => {
    setCurrentPage(1);
  }, [activeGroupObj?.pedidoNum, itemSearchTerm]);

  const filteredProducts = useMemo(() => {
      if (!activeGroupObj || !activeGroupObj.products) return [];
      const st = itemSearchTerm.toLowerCase().trim();
      if (!st) return activeGroupObj.products;
      return activeGroupObj.products.filter(p => {
          return (p.codArticulo || "").toLowerCase().includes(st) || (p.nombre || "").toLowerCase().includes(st);
      });
  }, [activeGroupObj, itemSearchTerm]);

  const sortedProducts = useMemo(() => {
      return [...filteredProducts].sort((a, b) => {
          const aPartial = a.historial && a.historial.some(h => h.accion && h.accion.toUpperCase().includes("PARCIAL"));
          const bPartial = b.historial && b.historial.some(h => h.accion && h.accion.toUpperCase().includes("PARCIAL"));
          
          if (aPartial && !bPartial) return -1;
          if (!aPartial && bPartial) return 1;
          
          const codeA = String(a.codArticulo || "");
          const codeB = String(b.codArticulo || "");
          return codeA.localeCompare(codeB, undefined, { numeric: true });
      });
  }, [filteredProducts]);

  if (!activeGroupObj) return null;

  const itemsPerPage = 24;
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage) || 1;
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelection = (e, p) => {
      e.stopPropagation();
      setSelectedBulkOrders(prev => {
          const isSelected = prev.some(o => o.id === p.id);
          if (isSelected) return prev.filter(o => o.id !== p.id);
          return [...prev, p];
      });
  };

  const selectAll = () => {
      if (selectedBulkOrders.length === filteredProducts.length && filteredProducts.length > 0) {
          setSelectedBulkOrders([]);
      } else {
          setSelectedBulkOrders([...filteredProducts]);
      }
  };

  return (
        <div className="fixed inset-0 bg-black/80  z-[90] flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-[95vw] theme-bg-main h-[90vh] sm:h-[95vh] rounded-[2rem] flex flex-col border theme-border shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                 <h2 className="text-xl font-black text-[var(--primary)] truncate flex items-center gap-2">ORDEN: {activeGroupObj.pedidoNum} <span className="text-sm bg-[var(--primary)]/10 px-2 py-0.5 rounded-lg text-[var(--primary)] font-bold tracking-widest border border-[var(--primary)]/20">({activeGroupObj.products.length} ÍTEMS)</span></h2>
                 <p className={`text-xs md:text-sm lg:text-base font-bold uppercase truncate mt-1 ${!activeGroupObj.cliente?.trim() ? 'text-orange-800 dark:text-orange-500' : 'theme-text-muted'}`}>{activeGroupObj.cliente?.trim() || 'CLIENTE NO REGISTRADO'}</p>
              </div>
              
              {selectedBulkOrders.length > 0 && (
                  <button type="button" onClick={() => setShowBulkModal(true)} className="px-4 py-2.5 bg-[var(--accent)] text-[var(--card-bg)] rounded-xl hover:brightness-110 transition-colors text-xs md:text-sm font-black mr-3 shadow-lg shadow-[var(--accent)]/30 animate-in zoom-in flex items-center gap-2 border border-white/20">
                      <Zap size={"1.2em"} /> ACCIÓN MASIVA ({selectedBulkOrders.length})
                  </button>
              )}

              <button type="button" onClick={() => { setSelectedGroupPedido(null); setShowDashboardModal(true); }} className="px-3 py-2 bg-[var(--primary)]/10 rounded-xl hover:bg-[var(--primary)]/20 transition-colors text-[var(--primary)] text-xs font-bold mr-2">⬅ Panel IA</button>
              <button type="button" onClick={() => setSelectedGroupPedido(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors text-[var(--primary)] shrink-0">✕</button>
            </div>

            <div className="p-4 border-b theme-border bg-black/5 shrink-0 flex items-center gap-3">
                <button type="button" onClick={selectAll} className="p-3 bg-[var(--primary)]/10 text-[var(--primary)] rounded-xl hover:bg-[var(--primary)]/20 transition-colors shrink-0 border border-[var(--primary)]/20 flex items-center justify-center" title="Seleccionar/Deseleccionar Todos">
                   {selectedBulkOrders.length === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={"1.2em"} /> : <Square size={"1.2em"} />}
                </button>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={"1.2em"} />
                    <input 
                        type="text" 
                        placeholder="🔍 Filtrar artículo o producto (Ej: 1234)..." 
                        className="w-full pl-9 pr-4 py-3 rounded-xl theme-bg-card font-bold text-xs md:text-sm lg:text-base outline-none border theme-border focus:ring-2 focus:ring-[var(--primary)] text-current"
                        value={itemSearchTerm} 
                        onChange={(e) => setItemSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col custom-scrollbar">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {paginatedProducts.map(p => {
                  const isPartial = p.historial && p.historial.some(h => h.accion && h.accion.toUpperCase().includes("PARCIAL"));
                  const partialEvents = isPartial ? p.historial.filter(h => h.accion && h.accion.toUpperCase().includes("PARCIAL")) : [];
                  const lastPartial = partialEvents.length > 0 ? partialEvents[partialEvents.length - 1] : null;

                  return (
                  <div key={p.id} onClick={() => setSelectedOrder(p)} className={`theme-bg-card p-4 rounded-2xl border-[2px] cursor-pointer hover:border-[var(--primary)] transition-colors active:scale-95 bg-[var(--card-bg)] relative flex flex-col justify-between ${selectedBulkOrders.some(o => o.id === p.id) ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm' : (isPartial ? 'border-yellow-400 dark:border-yellow-500 shadow-[0_0_12px_rgba(250,204,21,0.25)]' : 'theme-border shadow-sm')}`}>
                    
                    <div>
                        <button type="button" className="absolute top-3 right-3 p-1 rounded-md hover:bg-black/10 transition-colors" onClick={(e) => toggleSelection(e, p)}>
                            {selectedBulkOrders.some(o => o.id === p.id) ? <CheckSquare className="text-[var(--accent)]" size={"1.4em"} /> : <Square className="text-[var(--primary)]/30" size={"1.4em"} />}
                        </button>

                        <div className="flex justify-start items-center mb-2 pr-8">
                           {p.cantidad && (
                             <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm bg-orange-500/20 text-orange-800 dark:text-orange-500 px-2 py-1 rounded border border-orange-500/30 font-black truncate flex items-center gap-1">
                               <Package size={"1.1em"} /> CANT: {p.cantidad}
                             </span>
                           )}
                        </div>
                        <div className="mb-2">
                           <span title={p.codArticulo} className="inline-block max-w-full text-xs md:text-sm lg:text-base bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded border border-blue-500/30 font-black truncate">CÓD: {p.codArticulo}</span>
                        </div>
                        <h4 className="font-black text-xs md:text-sm lg:text-base uppercase leading-tight text-[var(--primary)]">{p.nombre}</h4>
                    </div>

                    <div className="mt-4 p-2 bg-[var(--bg-main)] rounded-xl border border-[var(--border-color)] flex flex-col gap-1.5">
                      <p className="text-xs md:text-sm lg:text-base font-black text-[var(--accent)] uppercase flex items-center gap-1 truncate"><MapPin size={"1.2em"}/> {p.areaActual}</p>
                      
                      {isPartial && lastPartial && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md px-2 py-1.5 flex flex-col gap-0.5 shadow-sm">
                            <span className="text-[10px] md:text-xs font-black text-yellow-700 dark:text-yellow-500 uppercase flex items-center gap-1">
                                <Package size="1.2em" /> Lote Parcial
                            </span>
                            <span className="text-[9px] md:text-[10px] font-bold text-yellow-800/80 dark:text-yellow-500/80 uppercase truncate">
                                De: {lastPartial.entrega || 'Sección Anterior'}
                            </span>
                        </div>
                      )}

                      {p.asignado_a && p.asignado_a.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] md:text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20 w-fit">
                            <UserCheck size="1.2em" /> {Array.isArray(p.asignado_a) ? p.asignado_a.join(', ') : p.asignado_a}
                          </div>
                      )}
                      <p className="text-xs md:text-sm lg:text-base font-black theme-text-muted uppercase flex items-center gap-1 mt-0.5 truncate"><Clock size={"1.2em"}/> {p.estadoInterno}</p>
                    </div>

                    {/* Botón Ver Planos */}
                    <div className="mt-3">
                        <button 
                            type="button" 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                alert(`Próximamente: Se abrirán los planos (PDF) para el producto ${p.codArticulo} vinculados a ReviSoft.`); 
                            }} 
                            className="w-full bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 py-2 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm uppercase transition-colors"
                        >
                            <FileText size={"1.2em"} /> Ver Planos
                        </button>
                    </div>
                  </div>
                )})}
              </div>
              
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center items-center gap-4 pb-4">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-6 py-3 border theme-border theme-bg-card text-[var(--primary)] font-black uppercase text-xs md:text-sm lg:text-base rounded-xl disabled:opacity-50 hover:bg-[var(--primary)] hover:text-[var(--card-bg)] transition-colors active:scale-95 shadow-sm"
                  >
                    Anterior
                  </button>
                  <span className="font-bold text-xs md:text-sm lg:text-base text-[var(--primary)] px-2">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-6 py-3 border theme-border theme-bg-card text-[var(--primary)] font-black uppercase text-xs md:text-sm lg:text-base rounded-xl disabled:opacity-50 hover:bg-[var(--primary)] hover:text-[var(--card-bg)] transition-colors active:scale-95 shadow-sm"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
  );
};

export default GroupDetailsModal;
