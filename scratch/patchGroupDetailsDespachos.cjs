const fs = require('fs');
let code = fs.readFileSync('src/components/orders/GroupDetailsModal.jsx', 'utf8');

const regex = /const isPartial = lastTransfer && lastTransfer\.accion\.toUpperCase\(\)\.includes\("PARCIAL"\) && !p\.isTerminado && p\.estadoInterno !== 'DESPACHADO' && p\.estado !== 'ENTREGADO';/;

const replacement = `const allFamily = (orders || []).filter(o => o.pedidoNum === p.pedidoNum && o.codArticulo === p.codArticulo);
                  const allFinishedOrDespacho = allFamily.every(o => o.areaActual === 'Despachos' || o.isTerminado || o.estadoInterno === 'DESPACHADO' || o.estado === 'ENTREGADO');
                  const isPartial = lastTransfer && lastTransfer.accion.toUpperCase().includes("PARCIAL") && !p.isTerminado && p.estadoInterno !== 'DESPACHADO' && p.estado !== 'ENTREGADO' && p.areaActual !== 'Despachos' && !allFinishedOrDespacho;`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/orders/GroupDetailsModal.jsx', code);
