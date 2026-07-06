import React, { useEffect } from 'react';
import { Search, MapPin, Clock, Camera, ImageIcon, Mic, MicOff, History, ChevronUp, ChevronDown, UserCheck, ArrowRightLeft, MessageSquare, Download, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';
import { CONFIG_PROCESOS, AREAS_RECEPCION } from '../../utils/constants';

const GroupDetailsModal = ({ activeGroupObj, handleImageUpload, addShiftNote, toggleMic }) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const { orders, setShowDashboardModal, setSelectedGroupPedido, setSelectedOrder, tempOperario, setTempOperario, tempShiftActivity, setTempShiftActivity, shiftNoteText, setShiftNoteText, tempPhoto, setTempPhoto, isListening, activeDictationTarget } = useAppContext();
  const { itemSearchTerm, setItemSearchTerm } = useAppStore();
  
  useEffect(() => {
    setCurrentPage(1);
  }, [activeGroupObj?.pedidoNum, itemSearchTerm]);

  if (!activeGroupObj) return null;

  const filteredProducts = activeGroupObj.products.filter(p => {
      const st = itemSearchTerm.toLowerCase().trim();
      if (!st) return true;
      return (p.codArticulo || "").toLowerCase().includes(st) || (p.nombre || "").toLowerCase().includes(st);
  });

  const itemsPerPage = 6;
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
        <div className="fixed inset-0 bg-black/80  z-[90] flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-4xl theme-bg-main h-[85vh] sm:h-[80vh] rounded-[2rem] flex flex-col border theme-border shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                 <h2 className="text-xl font-black text-[var(--primary)] truncate">ORDEN: {activeGroupObj.pedidoNum}</h2>
                 <p className={`text-xs md:text-sm lg:text-base font-bold uppercase truncate ${!activeGroupObj.cliente?.trim() ? 'text-orange-800 dark:text-orange-500' : 'theme-text-muted'}`}>{activeGroupObj.cliente?.trim() || 'CLIENTE NO REGISTRADO'}</p>
              </div>
              <button type="button" onClick={() => { setSelectedGroupPedido(null); setShowDashboardModal(true); }} className="px-3 py-2 bg-[var(--primary)]/10 rounded-xl hover:bg-[var(--primary)]/20 transition-colors text-[var(--primary)] text-xs font-bold mr-2">⬅ Panel IA</button>
              <button type="button" onClick={() => setSelectedGroupPedido(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors text-[var(--primary)] shrink-0">✕</button>
            </div>

            <div className="p-4 border-b theme-border bg-black/5 shrink-0">
                <div className="relative">
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
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedProducts.map(p => (
                  <div key={p.id} onClick={() => setSelectedOrder(p)} className="theme-bg-card p-4 rounded-2xl border-[2px] theme-border cursor-pointer hover:border-[var(--primary)] shadow-sm transition-colors active:scale-95 bg-[var(--card-bg)]">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-1 rounded border border-[var(--primary)]/30 font-black truncate">CÓD: {p.codArticulo}</span>
                       {p.cantidad && (
                         <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm bg-orange-500/20 text-orange-800 dark:text-orange-500 px-2 py-1 rounded border border-orange-500/30 font-black truncate flex items-center gap-1">
                           <Package size={"1.1em"} /> CANT: {p.cantidad}
                         </span>
                       )}
                    </div>
                    <h4 className="font-black text-xs md:text-sm lg:text-base uppercase leading-tight text-[var(--primary)]">{p.nombre}</h4>
                    <div className="mt-4 p-2 bg-[var(--bg-main)] rounded-xl border border-[var(--border-color)]">
                      <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] uppercase flex items-center gap-1 truncate"><MapPin size={"1.2em"}/> {p.areaActual}</p>
                      {p.asignado_a && p.asignado_a.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] md:text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20 w-fit">
                            <UserCheck size="1.2em" /> {Array.isArray(p.asignado_a) ? p.asignado_a.join(', ') : p.asignado_a}
                          </div>
                      )}
                      <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase flex items-center gap-1 mt-1 truncate"><Clock size={"1.2em"}/> {p.estadoInterno}</p>
                    </div>
                  </div>
                ))}
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
