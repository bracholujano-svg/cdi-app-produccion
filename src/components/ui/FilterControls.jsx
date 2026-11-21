import React from 'react';
import { Search, LayoutList } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';
import { AREAS } from '../../utils/constants';

export default function FilterControls({ uniqueClients }) {
    const { 
        areaFilter, setAreaFilter, 
        gridColumns, setGridColumns 
    } = useAppContext();
    
    const { 
        searchTerm, setSearchTerm, 
        clientFilter, setClientFilter,
        sortBy, setSortBy
    } = useAppStore();

    return (
        <div className="bg-white/90 dark:bg-[#111827]/95 px-3 py-2 md:px-4 flex flex-col lg:flex-row gap-2 border-t border-[#E2E8F0] dark:border-[#1E293B]">
            <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    type="text"
                    placeholder="Buscar pedido, artículo o producto..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#F4F5F7] dark:bg-[#0B1120] font-medium text-sm md:text-base outline-none border border-[#E2E8F0] dark:border-[#1E293B] focus:bg-white dark:focus:bg-slate-900 focus:border-[#2E435B] focus:ring-2 focus:ring-[#D4AF37]/25 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex gap-2 flex-1 md:flex-none">
                <div className="flex-1 lg:w-48">
                    <input 
                        list="client-options" 
                        type="text"
                        placeholder="Filtrar por cliente..."
                        className="w-full bg-[#F4F5F7] dark:bg-[#0B1120] px-3 py-2 rounded-lg font-medium text-sm outline-none border border-[#E2E8F0] dark:border-[#1E293B] focus:bg-white dark:focus:bg-slate-900 focus:border-[#2E435B] focus:ring-2 focus:ring-[#D4AF37]/25 text-ellipsis overflow-hidden text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all" 
                        value={clientFilter === 'Todos' ? '' : clientFilter} 
                        onChange={(e) => setClientFilter(e.target.value.toUpperCase() || 'Todos')}
                        onFocus={(e) => e.target.select()}
                    />
                    <datalist id="client-options">
                        {uniqueClients.map(c => <option key={c} value={c} />)}
                    </datalist>
                </div>
                <select
                    className="flex-1 lg:w-48 bg-[#F4F5F7] dark:bg-[#0B1120] px-3 py-2 rounded-lg font-medium text-sm outline-none border border-[#E2E8F0] dark:border-[#1E293B] focus:bg-white dark:focus:bg-slate-900 focus:border-[#2E435B] focus:ring-2 focus:ring-[#D4AF37]/25 cursor-pointer text-ellipsis overflow-hidden text-slate-800 dark:text-slate-100 transition-all"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="ninguno">Orden Original</option>
                    <option value="pedido_asc">Pedido (Asc)</option>
                    <option value="pedido_desc">Pedido (Desc)</option>
                    <option value="fecha_asc">F. Entrega (Asc)</option>
                    <option value="fecha_desc">F. Entrega (Desc)</option>
                </select>
            </div>
            
            <div className="flex gap-2 justify-between">
                <select
                    className="flex-1 md:w-52 bg-[#F4F5F7] dark:bg-[#0B1120] px-3 py-2 rounded-lg font-semibold text-sm outline-none border border-[#E2E8F0] dark:border-[#1E293B] focus:bg-white dark:focus:bg-slate-900 focus:border-[#2E435B] focus:ring-2 focus:ring-[#D4AF37]/25 cursor-pointer text-slate-800 dark:text-slate-100 transition-all"
                    value={areaFilter}
                    onChange={(e) => setAreaFilter(e.target.value)}
                >
                    <option value="Todas">Todas las Áreas</option>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                <div className="flex bg-[#F4F5F7] dark:bg-[#0B1120] border border-[#E2E8F0] dark:border-[#1E293B] rounded-lg p-0.5 gap-0.5 shrink-0 text-slate-700 dark:text-slate-200">
                    <button type="button" onClick={()=>setGridColumns(1)} className={`flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer ${gridColumns===1 ? 'bg-[#1E293B] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`} title="Vista tipo Lista (1 columna)">
                        <LayoutList size={16} />
                    </button>
                    <button type="button" onClick={()=>setGridColumns(2)} className={`flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer ${gridColumns===2 ? 'bg-[#1E293B] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`} title="Cuadrícula de 2 Columnas">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="18"></rect><rect x="13" y="3" width="8" height="18"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(3)} className={`flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer ${gridColumns===3 ? 'bg-[#1E293B] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`} title="Cuadrícula de 3 Columnas">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(4)} className={`hidden md:flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer ${gridColumns===4 ? 'bg-[#1E293B] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`} title="Cuadrícula de 4 Columnas">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"></rect><rect x="10" y="3" width="5" height="5"></rect><rect x="17" y="3" width="5" height="5"></rect><rect x="3" y="10" width="5" height="5"></rect><rect x="10" y="10" width="5" height="5"></rect><rect x="17" y="10" width="5" height="5"></rect><rect x="3" y="17" width="5" height="5"></rect><rect x="10" y="17" width="5" height="5"></rect><rect x="17" y="17" width="5" height="5"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(5)} className={`hidden md:flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer ${gridColumns===5 ? 'bg-[#1E293B] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`} title="Cuadrícula de 5 Columnas">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="4" height="18"></rect><rect x="8" y="3" width="4" height="18"></rect><rect x="14" y="3" width="4" height="18"></rect><rect x="20" y="3" width="4" height="18"></rect></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
