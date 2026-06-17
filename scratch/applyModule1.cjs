const fs = require('fs');

function applyModule1() {
    let appContent = fs.readFileSync('src/App.jsx', 'utf8');

    // 1. Add materialsSearchTerm to useAppContext destructuring if not present
    if (!appContent.includes('materialsSearchTerm,')) {
        appContent = appContent.replace(
            'activeAlertMaterials, setActiveAlertMaterials,',
            'activeAlertMaterials, setActiveAlertMaterials,\n    materialsSearchTerm, setMaterialsSearchTerm,'
        );
    }

    // 2. Modify MaterialsAlertModal JSX
    // First, find the modal header and add the search input
    const modalHeaderRegex = /<div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">([\s\S]*?)<\/div>/;
    
    // We need to inject the search bar AFTER the header, before the scrollable content.
    // The structure is:
    // <div className="theme-bg-card w-full max-w-2xl ...">
    //   <div className="p-5 theme-bg-header ...">...</div>
    //   <div className="p-5 overflow-y-auto ...">
    //     {activeAlertMaterials.some(...) && ...}
    //   </div>
    // </div>
    
    // Let's replace the whole modal content body using a precise regex.
    // We'll search for the activeAlertMaterials mappings and replace them.
    // Wait, earlier I split them into:
    // {activeAlertMaterials.some(m => m.faltante > 0) && (
    
    // It's safer to reconstruct the `showMaterialsAlertModal` block.
    const fullModalRegex = /\{showMaterialsAlertModal && \([\s\S]*?<div className="fixed inset-0[\s\S]*?<\/div>\s*\)\}/;
    
    const newModal = `{showMaterialsAlertModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="theme-bg-card w-full max-w-2xl rounded-[2rem] overflow-hidden shadow-2xl border theme-border flex flex-col max-h-[90vh]">
                <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={24} className="text-orange-500" />
                        <h2 className="text-lg font-black uppercase text-[var(--primary)]">Estado de Insumos</h2>
                    </div>
                    <button onClick={() => setShowMaterialsAlertModal(false)} className="p-2 bg-black/10 rounded-xl text-[var(--primary)]">✕</button>
                </div>
                
                <div className="p-4 border-b theme-border theme-bg-main">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]/50" size={20} />
                        <input 
                            type="text" 
                            placeholder="BUSCAR INSUMO O CÓDIGO..." 
                            value={materialsSearchTerm || ''} 
                            onChange={(e) => setMaterialsSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl theme-bg-input border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] font-bold uppercase text-xs md:text-sm lg:text-base text-[var(--primary)]"
                        />
                    </div>
                </div>

                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                    {(() => {
                        const filtered = activeAlertMaterials.filter(m => 
                            !materialsSearchTerm || 
                            m.descripcion?.toLowerCase().includes(materialsSearchTerm.toLowerCase()) || 
                            m.id_referencia?.toLowerCase().includes(materialsSearchTerm.toLowerCase())
                        );
                        
                        const faltantes = filtered.filter(m => m.faltante > 0);
                        const disponibles = filtered.filter(m => m.faltante <= 0);

                        if (filtered.length === 0) {
                            return (
                                <div className="text-center py-10 opacity-50 font-bold uppercase">
                                    No se encontraron insumos.
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-6">
                                {faltantes.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-black text-orange-600 uppercase border-b border-orange-200 pb-2">Materiales Faltantes (No Disponibles)</h3>
                                        {faltantes.map((mat, i) => (
                                            <div key={'f'+i} className="p-4 rounded-xl border flex flex-col gap-2 border-orange-200 bg-orange-50">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs md:text-sm lg:text-base font-black uppercase px-2 py-1 bg-white border rounded-md border-orange-200 text-orange-700">Ref: {mat.id_referencia}</span>
                                                    {mat.sinOC && <span className="text-xs font-black uppercase text-red-600 flex items-center gap-1"><AlertCircle size={"1.2em"}/> Sin Orden Compra</span>}
                                                </div>
                                                <p className="font-bold text-xs md:text-sm lg:text-base uppercase text-slate-800 leading-tight">{mat.descripcion}</p>
                                                <div className="flex gap-4 mt-1 border-t pt-2 flex-wrap border-orange-200">
                                                    <div className="flex flex-col"><span className="text-[10px] md:text-xs font-black text-slate-400 uppercase">Solicitada</span><span className="text-xs md:text-sm lg:text-base font-black text-slate-700">{mat.requerida}</span></div>
                                                    <div className="flex flex-col"><span className="text-[10px] md:text-xs font-black text-slate-400 uppercase">Asignada</span><span className="text-xs md:text-sm lg:text-base font-black text-slate-700">{mat.asignada}</span></div>
                                                    <div className="flex flex-col"><span className="text-[10px] md:text-xs font-black text-orange-600 uppercase">Faltante x Comprar</span><span className="text-xs md:text-sm lg:text-base font-black text-red-600">{mat.faltante}</span></div>
                                                    <div className="flex flex-col ml-auto"><span className="text-[10px] md:text-xs font-black text-slate-400 uppercase">Stock Remanente</span><span className="text-xs md:text-sm lg:text-base font-black text-slate-500">{mat.stockRestanteGlobal}</span></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {disponibles.length > 0 && (
                                    <div className="space-y-3 mt-6">
                                        <h3 className="text-sm font-black text-green-600 uppercase border-b border-green-200 pb-2">Materiales Disponibles (En Stock)</h3>
                                        {disponibles.map((mat, i) => (
                                            <div key={'d'+i} className="p-4 rounded-xl border flex flex-col gap-2 border-green-200 bg-green-50">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs md:text-sm lg:text-base font-black uppercase px-2 py-1 bg-white border rounded-md border-green-200 text-green-700">Ref: {mat.id_referencia}</span>
                                                </div>
                                                <p className="font-bold text-xs md:text-sm lg:text-base uppercase text-slate-800 leading-tight">{mat.descripcion}</p>
                                                <div className="flex gap-4 mt-1 border-t pt-2 flex-wrap border-green-200">
                                                    <div className="flex flex-col"><span className="text-[10px] md:text-xs font-black text-slate-400 uppercase">Solicitada</span><span className="text-xs md:text-sm lg:text-base font-black text-slate-700">{mat.requerida}</span></div>
                                                    <div className="flex flex-col"><span className="text-[10px] md:text-xs font-black text-slate-400 uppercase">Asignada</span><span className="text-xs md:text-sm lg:text-base font-black text-slate-700">{mat.asignada}</span></div>
                                                    <div className="flex flex-col ml-auto"><span className="text-[10px] md:text-xs font-black text-slate-400 uppercase">Stock Remanente</span><span className="text-xs md:text-sm lg:text-base font-black text-slate-500">{mat.stockRestanteGlobal}</span></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    )}`;

    appContent = appContent.replace(fullModalRegex, newModal);
    fs.writeFileSync('src/App.jsx', appContent);
}

applyModule1();
