const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderCard.jsx', 'utf8');

const regex = /const partialProductsCount = useMemo\(\(\) => \{\n\s*if \(\!group\.products\) return 0;\n\s*return group\.products\.filter\(p => \{\n\s*if \(\!p \|\| p\.isTerminado \|\| p\.estadoInterno === 'DESPACHADO' \|\| p\.estado === 'ENTREGADO'\) return false;\n\s*if \(\!p\.historial \|\| p\.historial\.length === 0\) return false;\n\s*const transfers = p\.historial\.filter\(h => h\.accion && \(h\.accion\.toUpperCase\(\)\.includes\("ENTREGA"\) \|\| h\.accion\.toUpperCase\(\)\.includes\("BIFURCACIÓN"\)\)\);\n\s*if \(transfers\.length === 0\) return false;\n\s*const lastTransfer = transfers\[transfers\.length - 1\];\n\s*return lastTransfer\.accion\.toUpperCase\(\)\.includes\("PARCIAL"\);\n\s*\}\)\.length;\n\s*\}, \[group\.products\]\);/;

const replacement = `const partialProductsCount = useMemo(() => {
      if (!group.products) return 0;
      return group.products.filter(p => {
          if (!p || p.isTerminado || p.estadoInterno === 'DESPACHADO' || p.estado === 'ENTREGADO' || p.areaActual === 'Despachos') return false;
          
          // Check if ALL products of this type for this order are in Despachos or Terminado
          // (If yes, it's not a partial situation anymore)
          const allFamily = (orders || []).filter(o => o.pedidoNum === p.pedidoNum && o.codArticulo === p.codArticulo);
          const allFinishedOrDespacho = allFamily.every(o => o.areaActual === 'Despachos' || o.isTerminado || o.estadoInterno === 'DESPACHADO' || o.estado === 'ENTREGADO');
          if (allFinishedOrDespacho) return false;

          if (!p.historial || p.historial.length === 0) return false;
          const transfers = p.historial.filter(h => h.accion && (h.accion.toUpperCase().includes("ENTREGA") || h.accion.toUpperCase().includes("BIFURCACIÓN")));
          if (transfers.length === 0) return false;
          const lastTransfer = transfers[transfers.length - 1];
          return lastTransfer.accion.toUpperCase().includes("PARCIAL");
      }).length;
  }, [group.products, orders]);`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/orders/OrderCard.jsx', code);
