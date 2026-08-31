import React from 'react';
import { AlertTriangle, AlertCircle, Search } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function MaterialsAlertModal({ 
    activeAlertMaterials, 
    setShowMaterialsAlertModal 
}) {
    const materialsSearchTerm = useAppStore(state => state.materialsSearchTerm);
    const setMaterialsSearchTerm = useAppStore(state => state.setMaterialsSearchTerm);

    const isNoMaterials = activeAlertMaterials.length === 0;
    const isModalAlert = activeAlertMaterials.some(m => m.faltante > 0);
    
    const filtered = activeAlertMaterials.filter(m => 
        !materialsSearchTerm || 
        m.descripcion?.toLowerCase().includes(materialsSearchTerm.toLowerCase()) || 
        m.id_referencia?.toLowerCase().includes(materialsSearchTerm.toLowerCase())
    );
    
    const faltantes = filtered.filter(m => m.faltante > 0).sort((a, b) => (b.sinOC ? 1 : 0) - (a.sinOC ? 1 : 0));
    const disponibles = filtered.filter(m => m.faltante <= 0);

    return (
        <div className="fixed inset-0 bg-black/80  z-[150] flex items-center justify-center p-4">
            <div className={`w-full max-w-7xl theme-bg-card rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in duration-300 ${isNoMaterials ? 'border-yellow-500/30' : isModalAlert ? 'border-orange-500/30' : 'border-green-500/30'}`}>
            <div className={`p-5 border-b flex justify-between items-center shrink-0 ${isNoMaterials ? 'bg-yellow-500/10 border-yellow-500/20' : isModalAlert ? 'bg-orange-500/10 border-orange-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                <h2 className={`text-lg font-black uppercase flex items-center gap-2 ${isNoMaterials ? 'text-yellow-600' : isModalAlert ? 'text-orange-600' : 'text-[var(--color-primary)]'}`}>
                    <AlertTriangle size={"1.2em"} className={isModalAlert && !isNoMaterials ? "animate-pulse" : ""}/>
                    {isNoMaterials ? 'Sin Insumos Requeridos' : 'Estado de Insumos - O.C.'}
                </h2>
                {!isNoMaterials && (
                    <div className="relative w-64 group hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted group-focus-within:text-[var(--color-primary)] transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar insumo (Ref o Nombre)..." 
                            value={materialsSearchTerm || ''} 
                            onChange={(e) => setMaterialsSearchTerm(e.target.value)} 
                            className="w-full pl-9 pr-3 py-2 rounded-xl theme-bg-input border theme-border font-bold text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all placeholder:font-normal"
                        />
                    </div>
                )}
            </div>

            <div className="p-4 md:p-6 bg-[var(--color-surface)] border-b theme-border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shrink-0">
                <p className="font-bold text-sm md:text-base theme-text-muted leading-relaxed max-w-3xl">
                    {isNoMaterials ? 
                        "No se encontraron explosiones de materiales en Supabase para este pedido. Esto significa que el producto no requiere insumos controlados o la receta no está sincronizada." 
                        : "A continuación se muestra la disponibilidad de materiales cruzada contra el stock global de Supabase. Los materiales marcados en rojo no tienen suficiente stock y bloquearán la producción si no se gestionan."
                    }
                </p>

                {!isNoMaterials && (
                    <div className="grid grid-cols-2 gap-2 md:gap-6 pr-2 md:pr-4">
                        <h3 className="text-[14px] md:text-lg font-black text-orange-500 uppercase border-b-2 border-orange-500/30 pb-1">Materiales Faltantes</h3>
                        <h3 className="text-[14px] md:text-lg font-black text-green-500 uppercase border-b-2 border-green-500/30 pb-1">Materiales Disponibles</h3>
                    </div>
                )}
            </div>

            <div className="px-4 md:px-5 py-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                
                {isNoMaterials ? (
                    <div className="p-10 rounded-xl border border-dashed border-yellow-200 bg-yellow-50 text-center">
                        <AlertTriangle size={48} className="mx-auto mb-4 text-yellow-400 opacity-50" />
                        <span className="text-sm md:text-base font-black text-yellow-600 uppercase">Sin información de insumos</span>
                        <p className="text-sm md:text-base font-bold text-yellow-500/80 mt-2">El sistema no detectó ningún requerimiento de material en Supabase asociado a este pedido y/o artículo.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2 md:gap-6">
                            <div className="space-y-3">
                                {faltantes.length > 0 ? (
                                    faltantes.map((mat, i) => (
                                        <div key={'f'+i} className="p-4 rounded-xl border flex flex-col gap-2 border-orange-200 bg-orange-50">
                                            <div className="flex justify-between items-start">
                                                <span className="text-base lg:text-lg font-black uppercase px-2 py-1 theme-bg-card border rounded-md border-orange-200 text-orange-700">Ref: {mat.id_referencia}</span>
                                                {mat.sinOC && <span className="text-sm font-black uppercase text-red-600 flex items-center gap-1"><AlertCircle size={"1.2em"}/> Sin Orden Compra</span>}
                                            </div>
                                            <p className="font-bold text-base lg:text-lg uppercase text-slate-800 leading-tight">{mat.descripcion}</p>
                                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-2 border-t pt-3 border-orange-200">
                                                <div className="flex flex-col"><span className="text-sm md:text-base font-black text-slate-400 uppercase">Solicitada</span><span className="text-sm md:text-base font-black text-slate-700">{Number(mat.requerida).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                                <div className="flex flex-col"><span className="text-sm md:text-base font-black text-slate-400 uppercase">Asignada</span><span className="text-sm md:text-base font-black text-slate-700">{Number(mat.asignada).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                                <div className="flex flex-col"><span className="text-sm md:text-base font-black text-orange-600 uppercase">Faltante</span><span className="text-sm md:text-base font-black text-red-600">{Number.isFinite(mat.faltante) ? Number(mat.faltante).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1') : mat.faltante}</span></div>
                                                <div className="flex flex-col"><span className="text-sm md:text-base font-black text-slate-400 uppercase">Stock Reman.</span><span className="text-sm md:text-base font-black text-slate-500">{Number(mat.stockRestanteGlobal).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 rounded-xl border border-dashed border-orange-200 bg-orange-50/50 text-center">
                                        <span className="text-sm md:text-base font-bold text-orange-400 uppercase">Ningún material faltante.</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                {disponibles.length > 0 ? (
                                    disponibles.map((mat, i) => (
                                        <div key={'d'+i} className="p-4 rounded-xl border flex flex-col gap-2 border-green-200 bg-green-50">
                                            <div className="flex justify-between items-start">
                                                <span className="text-base lg:text-lg font-black uppercase px-2 py-1 theme-bg-card border rounded-md border-green-200 text-green-700">Ref: {mat.id_referencia}</span>
                                            </div>
                                            <p className="font-bold text-base lg:text-lg uppercase text-slate-800 leading-tight">{mat.descripcion}</p>
                                            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mt-2 border-t pt-3 border-green-200">
                                                <div className="flex flex-col"><span className="text-sm md:text-base font-black text-slate-400 uppercase">Solicitada</span><span className="text-sm md:text-base font-black text-slate-700">{Number(mat.requerida).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                                <div className="flex flex-col"><span className="text-sm md:text-base font-black text-slate-400 uppercase">Asignada</span><span className="text-sm md:text-base font-black text-slate-700">{Number(mat.asignada).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                                <div className="flex flex-col"><span className="text-sm md:text-base font-black text-slate-400 uppercase">Stock Reman.</span><span className="text-sm md:text-base font-black text-slate-500">{Number(mat.stockRestanteGlobal).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 rounded-xl border border-dashed border-green-200 bg-green-50/50 text-center">
                                        <span className="text-sm md:text-base font-bold text-green-400 uppercase">Ningún material disponible.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                )}
            </div>
            <div className="p-4 bg-black/5 border-t theme-border flex justify-end">
                <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className={`text-white font-black uppercase text-base lg:text-lg px-6 py-3 rounded-xl transition-colors duration-200 hover:brightness-125 active:scale-95 ${isNoMaterials ? 'bg-yellow-500 border border-yellow-700' : isModalAlert ? 'bg-orange-500 border border-orange-700' : 'bg-[var(--color-primary)] border border-green-700'}`}>Entendido</button>
            </div>
            </div>
        </div>
    );
}
