import React from 'react';
import { Search, MapPin, Clock, Camera, ImageIcon, Mic, MicOff, History, ChevronUp, ChevronDown, UserCheck, ArrowRightLeft, MessageSquare, Download, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS, AREAS_RECEPCION } from '../../utils/constants';

const GroupDetailsModal = ({ handleImageUpload, addShiftNote, toggleMic }) => {
  const { activeGroupObj, setSelectedGroupPedido, itemSearchTerm, setItemSearchTerm, setSelectedOrder, setActiveGroupObj, tempOperario, setTempOperario, tempShiftActivity, setTempShiftActivity, shiftNoteText, setShiftNoteText, tempPhoto, setTempPhoto, isListening, activeDictationTarget } = useAppContext();
  
  return (
      
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-4xl theme-bg-main h-[85vh] sm:h-[80vh] rounded-[2rem] flex flex-col border theme-border shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                 <h2 className="text-xl font-black text-[var(--primary)] truncate">ORDEN: {activeGroupObj.pedidoNum}</h2>
                 <p className="text-xs md:text-sm lg:text-base font-bold theme-text-muted uppercase truncate">{activeGroupObj.cliente}</p>
              </div>
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

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 custom-scrollbar">
              {(activeGroupObj.products || []).filter(p => {
                  const st = itemSearchTerm.toLowerCase().trim();
                  if (!st) return true;
                  return (p.codArticulo || "").toLowerCase().includes(st) || (p.nombre || "").toLowerCase().includes(st);
              }).map(p => (
                <div key={p.id} onClick={() => setSelectedOrder(p)} className="theme-bg-card p-4 rounded-2xl border-[2px] theme-border cursor-pointer hover:border-[var(--primary)] shadow-sm transition-all active:scale-95 bg-[var(--card-bg)]">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-1 rounded border border-[var(--primary)]/30 font-black truncate">CÓD: {p.codArticulo}</span>
                  </div>
                  <h4 className="font-black text-xs md:text-sm lg:text-base uppercase leading-tight text-[var(--primary)]">{p.nombre}</h4>
                  <div className="mt-4 p-2 bg-[var(--bg-main)] rounded-xl border border-[var(--border-color)]">
                    <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] uppercase flex items-center gap-1 truncate"><MapPin size={"1.2em"}/> {p.areaActual}</p>
                    <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase flex items-center gap-1 mt-1 truncate"><Clock size={"1.2em"}/> {p.estadoInterno}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      
  );
};

export default GroupDetailsModal;
