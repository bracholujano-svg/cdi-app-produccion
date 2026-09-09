const fs = require('fs');
let code = fs.readFileSync('src/components/orders/BulkOrderDetailsModal.jsx', 'utf8');

if (!code.includes('const [tempPartialQty, setTempPartialQty] = React.useState(0);')) {
  code = code.replace(
    'const [isTerminadoLocal, setIsTerminadoLocal] = React.useState(false);',
    'const [isTerminadoLocal, setIsTerminadoLocal] = React.useState(false);\n  const [tempPartialQty, setTempPartialQty] = React.useState(0);'
  );
}

code = code.replace(
  /setTempIsPartial\(false\);\n\s*setOpenSection\(null\);/,
  'setTempIsPartial(false);\n      setTempPartialQty(0);\n      setOpenSection(null);'
);

const uiBlock = `{transferPhoto && <img src={transferPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        
                        <div className="mb-2 p-3 bg-black/5 rounded-xl border border-black/10">
                            <label className="flex items-center gap-2 cursor-pointer transition-colors">
                                <input type="checkbox" checked={tempIsPartial} onChange={(e) => { setTempIsPartial(e.target.checked); if(!e.target.checked) setTempPartialQty(0); }} className="w-5 h-5 accent-[var(--color-primary)] rounded cursor-pointer" />
                                <span className="text-base lg:text-lg font-black theme-text-main">ENTREGA PARCIAL / PARTES</span>
                            </label>
                            {tempIsPartial && selectedBulkOrders.length === 1 && selectedBulkOrders[0].cantidad > 1 && (
                                <div className="mt-3 flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-300 dark:border-slate-700">
                                    <span className="font-bold text-sm theme-text-main">Cantidad a entregar:</span>
                                    <input type="number" min="1" max={selectedBulkOrders[0].cantidad || 99999} value={tempPartialQty || ''} onChange={e => setTempPartialQty(parseInt(e.target.value) || 0)} className="w-24 p-2 bg-slate-100 dark:bg-slate-800 rounded font-bold outline-none border focus:border-[var(--color-primary)]" placeholder="Cant" />
                                    <span className="text-xs text-slate-500 font-bold">de {selectedBulkOrders[0].cantidad} total (Dejar vacío si es entrega de "partes")</span>
                                </div>
                            )}
                            {tempIsPartial && (selectedBulkOrders.length > 1 || (selectedBulkOrders.length === 1 && selectedBulkOrders[0].cantidad === 1)) && (
                                <div className="mt-2 text-sm text-[var(--color-primary)] font-bold">
                                    (Entrega parcial de partes para el mismo lote sin dividir cantidad)
                                </div>
                            )}
                        </div>
                        
                        <button type="button" onClick={()=>{
                              const en = document.getElementById('entregadoPorBulk').value.trim().toUpperCase();
                              if(en && tempTransferDate && tempTransferAreas.length > 0) {
                                if (tempIsPartial && tempTransferAreas.length > 1) { alert("No se puede hacer bifurcación a múltiples áreas y entrega parcial al mismo tiempo. Seleccione solo un área destino."); return; }
                                if (tempIsPartial && tempPartialQty && selectedBulkOrders.length === 1) {
                                   if (tempPartialQty <= 0 || tempPartialQty >= (selectedBulkOrders[0].cantidad || 99999)) {
                                       alert("Para una entrega parcial, indique una cantidad válida menor al total del lote."); 
                                       return;
                                   }
                                }
                                updateTransfer(selectedBulkOrders.map(o => o.id), tempTransferAreas, tempTransferDate, en, null, tempIsPartial, tempIsPartial && tempPartialQty ? tempPartialQty : false);
                                setTempIsPartial(false);
                                setTempPartialQty(0);
                              } else {
                                alert("Debe seleccionar al menos un área de destino, firmar la entrega e indicar la fecha.");
                              }
                          }} className="w-full bg-[var(--color-primary)] text-[var(--color-surface)] py-4 rounded-xl font-black uppercase text-base lg:text-lg shadow-sm border border-[var(--color-border)] transition-colors duration-200   hover:brightness-125 active:scale-95">Confirmar Entrega de Sección</button>`;

code = code.replace(
  /\{transferPhoto && <img src=\{transferPhoto\} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" \/>\}[\s\S]*?Confirmar Entrega de Sección<\/button>/,
  uiBlock
);

fs.writeFileSync('src/components/orders/BulkOrderDetailsModal.jsx', code);
