const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderDetailsModal.jsx', 'utf8');

code = code.replace(
  /if \(tempIsPartial && \(!tempPartialQty \|\| tempPartialQty <= 0 \|\| tempPartialQty >= \(selectedOrder\.cantidad \|\| 99999\)\)\) \{ alert\("Para una entrega parcial, indique una cantidad válida menor al total del lote\."\); return; \}/,
  ''
);

code = code.replace(
  /updateTransfer\(selectedOrder\.id, tempTransferAreas, tempTransferDate, en, null, tempIsPartial \? tempPartialQty : false\);/g,
  `if (tempIsPartial && tempPartialQty && (tempPartialQty <= 0 || tempPartialQty >= (selectedOrder.cantidad || 99999))) { alert("Para una entrega parcial, indique una cantidad válida menor al total del lote."); return; }
                                updateTransfer(selectedOrder.id, tempTransferAreas, tempTransferDate, en, null, tempIsPartial, tempIsPartial && tempPartialQty ? tempPartialQty : false);`
);

code = code.replace(
  '<span className="text-xs text-slate-500 font-bold">de {selectedOrder.cantidad} total</span>',
  '<span className="text-xs text-slate-500 font-bold">de {selectedOrder.cantidad} total (Dejar vacío si es entrega de "partes")</span>'
);

code = code.replace(
  '<span className="text-base lg:text-lg font-black theme-text-main">ENTREGA PARCIAL (FRACCIONAR LOTE)</span>',
  '<span className="text-base lg:text-lg font-black theme-text-main">ENTREGA PARCIAL / PARTES</span>'
);

fs.writeFileSync('src/components/orders/OrderDetailsModal.jsx', code);
