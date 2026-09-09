const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderDetailsModal.jsx', 'utf8');

const regex = /if \(tempIsPartial && \(\!tempPartialQty || tempPartialQty <= 0 || tempPartialQty >= \(selectedOrder\.cantidad \|\| 99999\)\)\) \{ alert\("Para una entrega parcial, indique una cantidad válida menor al total del lote\."\); return; \}/;

const replacement = `if (tempIsPartial && (!tempPartialQty || tempPartialQty <= 0 || tempPartialQty >= (selectedOrder.cantidad || 99999))) { alert("Para una entrega parcial, indique una cantidad válida menor al total del lote."); return; }
                                if (tempIsPartial && tempTransferAreas.length > 1) { alert("No se puede hacer bifurcación (múltiples áreas) y entrega parcial fraccionada al mismo tiempo. Seleccione solo un área destino."); return; }`;

code = code.replace(regex, replacement);

fs.writeFileSync('src/components/orders/OrderDetailsModal.jsx', code);
