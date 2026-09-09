const fs = require('fs');
let code = fs.readFileSync('src/components/orders/GroupDetailsModal.jsx', 'utf8');

const regex = /const isPartial = p\.historial && p\.historial\.some\(h => h\.accion && h\.accion\.toUpperCase\(\)\.includes\("PARCIAL"\)\);\n\s*const partialEvents = isPartial \? p\.historial\.filter\(h => h\.accion && h\.accion\.toUpperCase\(\)\.includes\("PARCIAL"\)\) : \[\];\n\s*const lastPartial = partialEvents\.length > 0 \? partialEvents\[partialEvents\.length - 1\] : null;/;

const replacement = `const transferEvents = (p.historial || []).filter(h => h.accion && (h.accion.toUpperCase().includes("ENTREGA") || h.accion.toUpperCase().includes("BIFURCACIÓN")));
                  const lastTransfer = transferEvents.length > 0 ? transferEvents[transferEvents.length - 1] : null;
                  const isPartial = lastTransfer && lastTransfer.accion.toUpperCase().includes("PARCIAL") && !p.isTerminado && p.estadoInterno !== 'DESPACHADO' && p.estado !== 'ENTREGADO';
                  const lastPartial = isPartial ? lastTransfer : null;`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/orders/GroupDetailsModal.jsx', code);
