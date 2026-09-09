const fs = require('fs');

// PATCH ORDER CARD
let code1 = fs.readFileSync('src/components/orders/OrderCard.jsx', 'utf8');
const startIdx1 = code1.indexOf('const partialProductsCount = useMemo(() => {');
const endIdx1 = code1.indexOf('}, [group.products]);', startIdx1);

const replacement1 = `const partialProductsCount = useMemo(() => {
      if (!group.products) return 0;
      return group.products.filter(p => {
          if (!p || p.isTerminado || p.estadoInterno === 'DESPACHADO' || p.estado === 'ENTREGADO' || p.areaActual === 'Despachos') return false;
          
          const allFamily = (orders || []).filter(o => o.pedidoNum === p.pedidoNum && o.codArticulo === p.codArticulo);
          if (allFamily.length > 0) {
              const allFinishedOrDespacho = allFamily.every(o => o.areaActual === 'Despachos' || o.isTerminado || o.estadoInterno === 'DESPACHADO' || o.estado === 'ENTREGADO');
              if (allFinishedOrDespacho) return false;
          }

          if (!p.historial || p.historial.length === 0) return false;
          const transfers = p.historial.filter(h => h.accion && (h.accion.toUpperCase().includes('ENTREGA') || h.accion.toUpperCase().includes('BIFURCACIÓN')));
          if (transfers.length === 0) return false;
          const lastTransfer = transfers[transfers.length - 1];
          return lastTransfer.accion.toUpperCase().includes('PARCIAL');
      }).length;
  }, [group.products, orders]);`;

if (startIdx1 !== -1 && endIdx1 !== -1) {
    code1 = code1.substring(0, startIdx1) + replacement1 + code1.substring(endIdx1 + '}, [group.products]);'.length);
    fs.writeFileSync('src/components/orders/OrderCard.jsx', code1);
    console.log('OrderCard updated');
} else {
    console.log('OrderCard failed');
}

// PATCH GROUP DETAILS MODAL
let code2 = fs.readFileSync('src/components/orders/GroupDetailsModal.jsx', 'utf8');
const startIdx2 = code2.indexOf('const transferEvents = (p.historial || []).filter');
const endIdx2 = code2.indexOf('const lastPartial = isPartial ? lastTransfer : null;', startIdx2);

const replacement2 = `const allFamily = (orders || []).filter(o => o.pedidoNum === p.pedidoNum && o.codArticulo === p.codArticulo);
                  const allFinishedOrDespacho = allFamily.length > 0 ? allFamily.every(o => o.areaActual === 'Despachos' || o.isTerminado || o.estadoInterno === 'DESPACHADO' || o.estado === 'ENTREGADO') : false;
                  
                  const transferEvents = (p.historial || []).filter(h => h.accion && (h.accion.toUpperCase().includes("ENTREGA") || h.accion.toUpperCase().includes("BIFURCACIÓN")));
                  const lastTransfer = transferEvents.length > 0 ? transferEvents[transferEvents.length - 1] : null;
                  const isPartial = lastTransfer && lastTransfer.accion.toUpperCase().includes("PARCIAL") && !p.isTerminado && p.estadoInterno !== 'DESPACHADO' && p.estado !== 'ENTREGADO' && p.areaActual !== 'Despachos' && !allFinishedOrDespacho;
                  const lastPartial = isPartial ? lastTransfer : null;`;

if (startIdx2 !== -1 && endIdx2 !== -1) {
    code2 = code2.substring(0, startIdx2) + replacement2 + code2.substring(endIdx2 + 'const lastPartial = isPartial ? lastTransfer : null;'.length);
    fs.writeFileSync('src/components/orders/GroupDetailsModal.jsx', code2);
    console.log('GroupDetailsModal updated');
} else {
    console.log('GroupDetailsModal failed');
}
