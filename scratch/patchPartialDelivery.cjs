const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderCard.jsx', 'utf8');

code = code.replace(
  /return group\.products\.filter\(p => p && p\.historial && p\.historial\.some\(h => h\.accion && h\.accion\.toUpperCase\(\)\.includes\("PARCIAL"\)\)\)\.length;/,
  'return group.products.filter(p => p && !p.isTerminado && p.historial && p.historial.some(h => h.accion && h.accion.toUpperCase().includes("PARCIAL"))).length;'
);

fs.writeFileSync('src/components/orders/OrderCard.jsx', code);

let code2 = fs.readFileSync('src/components/orders/GroupDetailsModal.jsx', 'utf8');
code2 = code2.replace(
  /\{isPartial && lastPartial && \(/g,
  '{!isSemaforoTerminado && isPartial && lastPartial && ('
);
fs.writeFileSync('src/components/orders/GroupDetailsModal.jsx', code2);
