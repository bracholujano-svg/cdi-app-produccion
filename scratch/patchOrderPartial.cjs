const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderDetailsModal.jsx', 'utf8');

const regex = /<label className="flex items-center gap-2 mb-2 p-3 bg-black\/5 rounded-xl border border-black\/10 cursor-pointer hover:bg-black\/10 transition-colors">[\s\S]*?<\/label>/;

const replacement = `<div className="mb-2 p-3 bg-black/5 rounded-xl border border-black/10">
                            <label className="flex items-center gap-2 cursor-pointer transition-colors">
                                <input type="checkbox" checked={tempIsPartial} onChange={(e) => { setTempIsPartial(e.target.checked); if(!e.target.checked) setTempPartialQty(0); }} className="w-5 h-5 accent-[var(--color-primary)] rounded cursor-pointer" />
                                <span className="text-base lg:text-lg font-black theme-text-main">ENTREGA PARCIAL (FRACCIONAR LOTE)</span>
                            </label>
                            {tempIsPartial && (
                                <div className="mt-3 flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-300 dark:border-slate-700">
                                    <span className="font-bold text-sm theme-text-main">Cantidad a entregar:</span>
                                    <input type="number" min="1" max={selectedOrder.cantidad || 99999} value={tempPartialQty || ''} onChange={e => setTempPartialQty(parseInt(e.target.value) || 0)} className="w-24 p-2 bg-slate-100 dark:bg-slate-800 rounded font-bold outline-none border focus:border-[var(--color-primary)]" placeholder="Cant" />
                                    <span className="text-xs text-slate-500 font-bold">de {selectedOrder.cantidad} total</span>
                                </div>
                            )}
                        </div>`;

code = code.replace(regex, replacement);

const btnRegex = /updateTransfer\(selectedOrder\.id, tempTransferAreas, tempTransferDate, en, null, tempIsPartial\);/;
const btnReplacement = `if (tempIsPartial && (!tempPartialQty || tempPartialQty <= 0 || tempPartialQty >= (selectedOrder.cantidad || 99999))) { alert("Para una entrega parcial, indique una cantidad válida menor al total del lote."); return; }
                                updateTransfer(selectedOrder.id, tempTransferAreas, tempTransferDate, en, null, tempIsPartial ? tempPartialQty : false);`;

code = code.replace(btnRegex, btnReplacement);
fs.writeFileSync('src/components/orders/OrderDetailsModal.jsx', code);
