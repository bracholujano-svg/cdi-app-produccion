const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

const startStr = '{showMaterialsAlertModal && (';
const endStr = '<style>{`';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const oldBlock = content.substring(startIndex, endIndex);
    
    const newModalContent = `{showMaterialsAlertModal && (
          (() => {
            const isModalAlert = activeAlertMaterials.some(m => m.faltante > 0);
            const withoutStock = activeAlertMaterials.filter(m => m.faltante > 0).sort((a, b) => (b.sinOC === true ? 1 : 0) - (a.sinOC === true ? 1 : 0));
            const withStock = activeAlertMaterials.filter(m => m.faltante <= 0);

            return (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                <div className={\`w-full max-w-6xl max-h-[90vh] flex flex-col theme-bg-card rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in duration-300 \${isModalAlert ? 'border-orange-500/30' : 'border-green-500/30'}\`}>
                  <div className={\`p-5 border-b flex justify-between items-center shrink-0 \${isModalAlert ? 'bg-orange-500/10 border-orange-500/20' : 'bg-green-500/10 border-green-500/20'}\`}>
                    <div className="flex flex-col">
                        <h2 className={\`text-lg font-black uppercase flex items-center gap-2 \${isModalAlert ? 'text-orange-600' : 'text-[var(--accent)]'}\`}>
                          {isModalAlert ? <AlertTriangle size={24} /> : <CheckCircle size={24} />} 
                          {isModalAlert ? 'Alerta de Insumos Insuficientes' : 'Inventario Suficiente'}
                        </h2>
                        <p className="text-xs font-bold text-slate-500 uppercase mt-1">
                            {isModalAlert ? 'Existen materiales que no cuentan con stock suficiente para cubrir este pedido.' : 'Este pedido cuenta con cobertura total de inventario para su ejecución.'}
                        </p>
                    </div>
                    <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className={\`p-2.5 rounded-xl transition-colors shrink-0 \${isModalAlert ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600' : 'bg-green-500/10 hover:bg-green-500/20 text-[var(--accent)]'}\`}>✕</button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#0B0F19]">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          
                          {/* Columna Izquierda: SIN STOCK */}
                          <div className="flex flex-col gap-3">
                              <h3 className="font-black text-orange-500 uppercase text-sm md:text-base border-b border-orange-500/30 pb-2 flex items-center gap-2">
                                  <AlertTriangle size={18}/> Materiales Faltantes ({withoutStock.length})
                              </h3>
                              <div className="space-y-3">
                                  {withoutStock.map((mat, i) => (
                                      <div key={i} className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 transition-colors flex flex-col gap-2 relative overflow-hidden group">
                                          {mat.sinOC && <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-bl-xl shadow-md">Sin OC</div>}
                                          <div className="flex justify-between items-start pr-12">
                                              <span className="text-xs font-black uppercase px-2 py-1 bg-black/40 border border-orange-500/20 text-orange-400 rounded-md">Ref: {mat.id_referencia}</span>
                                          </div>
                                          <p className="font-bold text-xs md:text-sm uppercase text-slate-200 leading-tight">{mat.descripcion}</p>
                                          
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 border-t border-orange-500/20 pt-3">
                                              <div className="flex flex-col bg-black/20 p-2 rounded-lg"><span className="text-[9px] font-black text-slate-400 uppercase leading-tight">Solicitada</span><span className="text-xs font-black text-slate-200">{Number(mat.requerida||0).toFixed(2)}</span></div>
                                              <div className="flex flex-col bg-black/20 p-2 rounded-lg"><span className="text-[9px] font-black text-slate-400 uppercase leading-tight">Asignada</span><span className="text-xs font-black text-slate-200">{Number(mat.asignada||0).toFixed(2)}</span></div>
                                              <div className="flex flex-col bg-red-500/10 border border-red-500/20 p-2 rounded-lg"><span className="text-[9px] font-black text-red-400 uppercase leading-tight">Faltante Comprar</span><span className="text-xs font-black text-red-500">{Number(mat.faltante||0).toFixed(2)}</span></div>
                                              <div className="flex flex-col bg-black/20 p-2 rounded-lg"><span className="text-[9px] font-black text-slate-400 uppercase leading-tight">Stock Remanente</span><span className="text-xs font-black text-slate-400">{Number(mat.stockRestanteGlobal||0).toFixed(2)}</span></div>
                                          </div>
                                      </div>
                                  ))}
                                  {withoutStock.length === 0 && (
                                      <div className="p-6 text-center border border-dashed border-slate-700 rounded-xl bg-black/20">
                                          <CheckCircle className="mx-auto text-green-500 mb-2 opacity-50" size={24}/>
                                          <p className="text-sm font-bold text-slate-500 uppercase">No hay materiales faltantes</p>
                                      </div>
                                  )}
                              </div>
                          </div>

                          {/* Columna Derecha: CON STOCK */}
                          <div className="flex flex-col gap-3">
                              <h3 className="font-black text-[var(--accent)] uppercase text-sm md:text-base border-b border-green-500/30 pb-2 flex items-center gap-2">
                                  <CheckCircle size={18}/> Materiales Completos ({withStock.length})
                              </h3>
                              <div className="space-y-3">
                                  {withStock.map((mat, i) => (
                                      <div key={i} className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 transition-colors flex flex-col gap-2 relative overflow-hidden">
                                          <div className="flex justify-between items-start">
                                              <span className="text-xs font-black uppercase px-2 py-1 bg-black/40 border border-green-500/20 text-green-400 rounded-md">Ref: {mat.id_referencia}</span>
                                          </div>
                                          <p className="font-bold text-xs md:text-sm uppercase text-slate-200 leading-tight">{mat.descripcion}</p>
                                          
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 border-t border-green-500/20 pt-3">
                                              <div className="flex flex-col bg-black/20 p-2 rounded-lg"><span className="text-[9px] font-black text-slate-400 uppercase leading-tight">Solicitada</span><span className="text-xs font-black text-slate-200">{Number(mat.requerida||0).toFixed(2)}</span></div>
                                              <div className="flex flex-col bg-black/20 p-2 rounded-lg"><span className="text-[9px] font-black text-slate-400 uppercase leading-tight">Asignada</span><span className="text-xs font-black text-slate-200">{Number(mat.asignada||0).toFixed(2)}</span></div>
                                              <div className="flex flex-col bg-green-500/10 border border-green-500/20 p-2 rounded-lg"><span className="text-[9px] font-black text-green-400 uppercase leading-tight">Faltante Comprar</span><span className="text-xs font-black text-green-500">0.00</span></div>
                                              <div className="flex flex-col bg-black/20 p-2 rounded-lg"><span className="text-[9px] font-black text-slate-400 uppercase leading-tight">Stock Remanente</span><span className="text-xs font-black text-slate-400">{Number(mat.stockRestanteGlobal||0).toFixed(2)}</span></div>
                                          </div>
                                      </div>
                                  ))}
                                  {withStock.length === 0 && (
                                      <div className="p-6 text-center border border-dashed border-slate-700 rounded-xl bg-black/20">
                                          <AlertTriangle className="mx-auto text-orange-500 mb-2 opacity-50" size={24}/>
                                          <p className="text-sm font-bold text-slate-500 uppercase">Todos los materiales están en déficit</p>
                                      </div>
                                  )}
                              </div>
                          </div>

                      </div>
                  </div>

                  <div className="p-4 bg-[#0B0F19] border-t theme-border flex justify-end shrink-0">
                    <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className={\`text-white font-black uppercase text-xs md:text-sm lg:text-base px-8 py-3.5 rounded-xl transition-all duration-200 hover:brightness-125 active:scale-95 shadow-lg \${isModalAlert ? 'bg-orange-600 shadow-orange-600/20 border border-orange-500' : 'bg-[var(--accent)] shadow-[var(--accent)]/20 border border-green-400'}\`}>ENTENDIDO</button>
                  </div>
                </div>
              </div>
            );
          })()
        )}
  
        `;

    content = content.replace(oldBlock, newModalContent);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('App.jsx modal rediseñado con éxito v4!');
} else {
    console.log('Error: indices not found. Start: ' + startIndex + ' End: ' + endIndex);
}
