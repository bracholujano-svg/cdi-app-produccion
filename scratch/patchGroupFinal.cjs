const fs = require('fs');

let code2 = fs.readFileSync('src/components/orders/GroupDetailsModal.jsx', 'utf8');
const startIdx2 = code2.indexOf('const isPartial = p.historial && p.historial.some(h => h.accion && h.accion.toUpperCase().includes("PARCIAL"));');
const endIdx2 = code2.indexOf('const lastPartial = partialEvents.length > 0 ? partialEvents[partialEvents.length - 1] : null;', startIdx2);

const replacement2 = `const allFamily = (orders || []).filter(o => o.pedidoNum === p.pedidoNum && o.codArticulo === p.codArticulo);
                  const allFinishedOrDespacho = allFamily.length > 0 ? allFamily.every(o => o.areaActual === 'Despachos' || o.isTerminado || o.estadoInterno === 'DESPACHADO' || o.estado === 'ENTREGADO') : false;
                  
                  const transferEvents = (p.historial || []).filter(h => h.accion && (h.accion.toUpperCase().includes("ENTREGA") || h.accion.toUpperCase().includes("BIFURCACIÓN")));
                  const lastTransfer = transferEvents.length > 0 ? transferEvents[transferEvents.length - 1] : null;
                  const isPartial = lastTransfer && lastTransfer.accion.toUpperCase().includes("PARCIAL") && !p.isTerminado && p.estadoInterno !== 'DESPACHADO' && p.estado !== 'ENTREGADO' && p.areaActual !== 'Despachos' && !allFinishedOrDespacho;
                  const lastPartial = isPartial ? lastTransfer : null;`;

if (startIdx2 !== -1 && endIdx2 !== -1) {
    code2 = code2.substring(0, startIdx2) + replacement2 + code2.substring(endIdx2 + 'const lastPartial = partialEvents.length > 0 ? partialEvents[partialEvents.length - 1] : null;'.length);
    fs.writeFileSync('src/components/orders/GroupDetailsModal.jsx', code2);
    console.log('GroupDetailsModal updated');
} else {
    console.log('GroupDetailsModal failed');
}
