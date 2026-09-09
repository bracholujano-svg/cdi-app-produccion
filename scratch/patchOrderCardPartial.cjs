const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderCard.jsx', 'utf8');

const regex = /const partialProductsCount = useMemo\(\(\) => \{\n\s*if \(\!group\.products\) return 0;\n\s*return group\.products\.filter\(p => p && \!p\.isTerminado && p\.historial && p\.historial\.some\(h => h\.accion && h\.accion\.toUpperCase\(\)\.includes\("PARCIAL"\)\)\)\.length;\n\s*\}, \[group\.products\]\);/;

const replacement = `const partialProductsCount = useMemo(() => {
      if (!group.products) return 0;
      return group.products.filter(p => {
          if (!p || p.isTerminado || p.estadoInterno === 'DESPACHADO' || p.estado === 'ENTREGADO') return false;
          if (!p.historial || p.historial.length === 0) return false;
          const transfers = p.historial.filter(h => h.accion && (h.accion.toUpperCase().includes("ENTREGA") || h.accion.toUpperCase().includes("BIFURCACIÓN")));
          if (transfers.length === 0) return false;
          const lastTransfer = transfers[transfers.length - 1];
          return lastTransfer.accion.toUpperCase().includes("PARCIAL");
      }).length;
  }, [group.products]);`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/orders/OrderCard.jsx', code);
