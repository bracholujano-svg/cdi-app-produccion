import React, { useState } from 'react';
import { LayoutList, Trash2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import CDILogo from '../ui/CDILogo';

export default function CoordViewModal({ deleteAlert }) {
    const { 
        coordinationAlerts, 
        setShowCoordViewModal,
        supervisorProfile
    } = useAppContext();

    const [coordSearchPedido, setCoordSearchPedido] = useState('');
    const [coordSearchFecha, setCoordSearchFecha] = useState('');
    const [coordSortOrder, setCoordSortOrder] = useState('desc');

    let filteredSortedAlerts = [...coordinationAlerts];
    if (coordSearchPedido) {
        filteredSortedAlerts = filteredSortedAlerts.filter(a => 
            a.pedidoNum.toLowerCase().includes(coordSearchPedido.toLowerCase())
        );
    }
    if (coordSearchFecha) {
        filteredSortedAlerts = filteredSortedAlerts.filter(a => 
            a.fechaEntrega === coordSearchFecha
        );
    }
    filteredSortedAlerts.sort((a, b) => {
        const dateA = new Date(a.fechaEntrega).getTime();
        const dateB = new Date(b.fechaEntrega).getTime();
        return coordSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-[2px] z-[110] flex items-center justify-center p-0 md:p-4">
            <div className="bg-white dark:bg-[#111827] w-full h-full md:max-w-5xl md:h-auto md:max-h-[85vh] md:rounded-2xl overflow-hidden flex flex-col shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="px-5 py-4 bg-[#1E293B] text-white border-b border-[#D4AF37]/30 flex justify-between items-center shrink-0 z-10">
                    <div className="flex items-center gap-3.5">
                        <CDILogo heightClass="h-10 w-auto" className="shrink-0" />
                        <span className="h-6 w-px bg-slate-700 hidden sm:block"></span>
                        <h2 className="text-base sm:text-lg font-bold uppercase tracking-tight">Plan Maestro de Despacho</h2>
                    </div>
                    <button type="button" onClick={() => setShowCoordViewModal(false)} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-200 hover:text-white transition-colors">✕</button>
                </div>
              
                <div className="p-4 bg-[var(--color-surface)] border-b theme-border flex flex-col md:flex-row gap-4 shrink-0">
                    <input 
                        type="text" 
                        placeholder="🔎 Buscar Nº Pedido..." 
                        value={coordSearchPedido} 
                        onChange={(e) => setCoordSearchPedido(e.target.value)} 
                        className="flex-1 p-3 rounded-xl theme-bg-input border theme-border font-bold text-base lg:text-lg outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-primary)] uppercase"
                    />
                    <div className="flex gap-4 flex-1">
                        <input 
                            type="date" 
                            value={coordSearchFecha} 
                            onChange={(e) => setCoordSearchFecha(e.target.value)} 
                            className="flex-1 p-3 rounded-xl theme-bg-input border theme-border font-bold text-base lg:text-lg outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-primary)]"
                        />
                        <button 
                            type="button" 
                            onClick={() => setCoordSearchFecha('')} 
                            className="px-4 rounded-xl border border-[var(--color-border)] font-bold text-base lg:text-lg uppercase theme-text-muted hover:text-[var(--color-primary)] hover:bg-black/5 transition-colors"
                            title="Limpiar Fecha"
                        >
                            Limpiar
                        </button>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => setCoordSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} 
                        className="px-5 py-3 rounded-xl border border-[var(--color-border)] font-bold text-base lg:text-lg uppercase flex items-center justify-center gap-2 theme-text-muted hover:text-[var(--color-primary)] hover:bg-black/5 transition-colors"
                    >
                        {coordSortOrder === 'asc' ? '⬇️ ASCENDENTE' : '⬆️ DESCENDENTE'}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSortedAlerts.map(alertItem => (
                            <div key={alertItem.id} className="theme-bg-main p-5 rounded-[1.5rem] border-[2px] theme-border relative flex flex-col shadow-sm transition-all hover:shadow-md">
                                {supervisorProfile?.area === "Administrador / Todos" && (
                                    <button type="button" onClick={() => deleteAlert(alertItem.id)} className="absolute top-4 right-4 p-2 theme-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"><Trash2 size={"1.2em"}/></button>
                                )}
                                <span className="text-lg font-black text-blue-600 dark:text-blue-400 uppercase block leading-none pr-8">PED: {alertItem.pedidoNum}</span>
                                <h4 className="text-sm font-bold text-[var(--color-primary)] uppercase mt-1 truncate">{alertItem.cliente}</h4>
                                
                                {supervisorProfile?.area === "Administrador / Todos" ? (
                                    <div className="mt-4 p-3 theme-bg-input rounded-xl border theme-border flex-1 flex flex-col justify-end">
                                        <p className="text-xs font-bold theme-text-muted uppercase mb-1">Notas Internas</p>
                                        <p className="text-sm font-medium theme-text-main leading-snug break-words">
                                            {alertItem.notas || "Sin notas"}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mt-4 p-3 theme-bg-input rounded-xl border theme-border flex-1 flex flex-col justify-end">
                                        <p className="text-xs font-bold theme-text-muted uppercase mb-1">Notas Despacho</p>
                                        <p className="text-sm font-medium theme-text-main leading-snug break-words">
                                            {alertItem.notas || "Sin notas"}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                        {filteredSortedAlerts.length === 0 && (
                            <div className="col-span-full text-center py-20">
                                <LayoutList size={48} className="mx-auto mb-4 theme-text-muted opacity-20" />
                                <p className="font-black uppercase tracking-widest theme-text-muted opacity-50">No hay planes registrados</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
