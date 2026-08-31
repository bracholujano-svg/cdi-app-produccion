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
        <div className="theme-bg-input p-2 flex flex-col lg:flex-row gap-2">
            <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={"1.2em"} />
                <input type="text" placeholder="Buscar pedido, artículo o producto..." className="w-full pl-8 pr-3 py-2 md:py-2.5 rounded-lg theme-bg-card font-bold text-base lg:text-lg outline-none border theme-border focus:ring-2 focus:ring-[var(--color-primary)] text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            <div className="flex gap-2 flex-1 md:flex-none">
                <div className="flex-1 lg:w-48">
                    <input 
                        list="client-options" 
                        type="text"
                        placeholder="BUSCAR CLIENTE..."
                        className="w-full theme-bg-card px-2 py-2 md:py-2.5 rounded-lg font-black text-sm md:text-base lg:text-sm uppercase outline-none border theme-border focus:ring-2 focus:ring-[var(--color-primary)] text-ellipsis overflow-hidden placeholder:normal-case placeholder:text-sm md:placeholder:text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400" 
                        value={clientFilter === 'Todos' ? '' : clientFilter} 
                        onChange={(e) => setClientFilter(e.target.value.toUpperCase() || 'Todos')}
                        onFocus={(e) => e.target.select()}
                    />
                    <datalist id="client-options">
                        {uniqueClients.map(c => <option key={c} value={c} />)}
                    </datalist>
                </div>
                <select className="flex-1 lg:w-48 theme-bg-card px-2 py-2 md:py-2.5 rounded-lg font-black text-sm md:text-base lg:text-sm uppercase outline-none border theme-border focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer text-ellipsis overflow-hidden theme-text-main" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="ninguno">Orden Original</option>
                    <option value="pedido_asc">Pedido (Asc)</option>
                    <option value="pedido_desc">Pedido (Desc)</option>
                    <option value="fecha_asc">F. Entrega (Asc)</option>
                    <option value="fecha_desc">F. Entrega (Desc)</option>
                </select>
            </div>
            
            <div className="flex gap-2 justify-between">
                <select className="flex-1 md:w-48 theme-bg-card px-3 py-2 md:py-2.5 rounded-lg font-black text-base lg:text-lg uppercase outline-none border theme-border focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer theme-text-main" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                    <option value="Todas">Todas las Áreas</option>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                <div className="flex theme-bg-card border theme-border rounded-lg p-0.5 gap-0.5 shrink-0 text-slate-900 dark:text-white">
                    <button type="button" onClick={()=>setGridColumns(1)} className={`flex md:hidden p-1.5 rounded-md transition-colors ${gridColumns===1 ? 'bg-[var(--color-primary)] text-[var(--color-surface)]' : 'theme-text-muted hover:bg-black/5'}`} title="Lista">
                        <LayoutList size={"1.2em"} />
                    </button>
                    <button type="button" onClick={()=>setGridColumns(2)} className={`flex md:hidden p-1.5 rounded-md transition-colors ${gridColumns===2 ? 'bg-[var(--color-primary)] text-[var(--color-surface)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Media">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(3)} className={`flex md:hidden p-1.5 rounded-md transition-colors ${gridColumns===3 ? 'bg-[var(--color-primary)] text-[var(--color-surface)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Pequeña">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"></rect><rect x="10" y="3" width="5" height="5"></rect><rect x="17" y="3" width="5" height="5"></rect><rect x="3" y="10" width="5" height="5"></rect><rect x="10" y="10" width="5" height="5"></rect><rect x="17" y="10" width="5" height="5"></rect><rect x="3" y="17" width="5" height="5"></rect><rect x="10" y="17" width="5" height="5"></rect><rect x="17" y="17" width="5" height="5"></rect></svg>
                    </button>

                    <button type="button" onClick={()=>setGridColumns(3)} className={`hidden md:flex p-1.5 rounded-md transition-colors ${gridColumns===3 ? 'bg-[var(--color-primary)] text-[var(--color-surface)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Grande">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(4)} className={`hidden md:flex p-1.5 rounded-md transition-colors ${gridColumns===4 ? 'bg-[var(--color-primary)] text-[var(--color-surface)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Mediana">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"></rect><rect x="10" y="3" width="5" height="5"></rect><rect x="17" y="3" width="5" height="5"></rect><rect x="3" y="10" width="5" height="5"></rect><rect x="10" y="10" width="5" height="5"></rect><rect x="17" y="10" width="5" height="5"></rect><rect x="3" y="17" width="5" height="5"></rect><rect x="10" y="17" width="5" height="5"></rect><rect x="17" y="17" width="5" height="5"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(5)} className={`hidden md:flex p-1.5 rounded-md transition-colors ${gridColumns===5 ? 'bg-[var(--color-primary)] text-[var(--color-surface)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Pequeña">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="4" height="18"></rect><rect x="8" y="3" width="4" height="18"></rect><rect x="14" y="3" width="4" height="18"></rect><rect x="20" y="3" width="4" height="18"></rect></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
