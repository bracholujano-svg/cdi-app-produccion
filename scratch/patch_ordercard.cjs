const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'orders', 'OrderCard.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

if (!content.includes('import React, { useMemo } from')) {
    content = content.replace("import React from 'react';", "import React, { useMemo } from 'react';");
}

if (!content.includes('export default React.memo(OrderCard')) {
    content = content.replace("export default OrderCard;", `export default React.memo(OrderCard, (prevProps, nextProps) => {
  return prevProps.group === nextProps.group;
});`);
}

content = content.replace(/\{\(\(\) => \{[\s\S]*?const totalUnits = group\.products\.length;[\s\S]*?const progressPercent = Math\.round\(\(processedUnits \/ totalUnits\) \* 100\);[\s\S]*?return \([\s\S]*?\}\)\(\)\}/g, `
      {useMemo(() => {
        if (!group.products || group.products.length === 0) return null;
        const totalUnits = group.products.length;
        const processedUnits = group.products.filter(p => {
          if (areaFilter === 'Todas' || areaFilter === 'Administrador / Todos') return p.estadoInterno === 'DESPACHADO';
          if (String(p.areaActual).trim() === areaFilter.trim() && String(p.estadoInterno).toUpperCase() !== 'EN ESPERA') return true;
          const wasInMyArea = (p.historial || []).some(h => 
            (h.accion && h.accion.toUpperCase().includes(areaFilter.toUpperCase())) ||
            (h.entrega && h.entrega.toUpperCase() === areaFilter.toUpperCase())
          );
          return wasInMyArea;
        }).length;

        const progressPercent = Math.round((processedUnits / totalUnits) * 100);

        return (
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[9px] md:text-[10px] font-black uppercase text-[var(--primary)] opacity-70">
              <span className="flex items-center gap-1"><Activity size={10} /> Avance de Sección</span>
              <span>{processedUnits} / {totalUnits} ({progressPercent}%)</span>
            </div>
            <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
              <div 
                className={\`h-full rounded-full transition-all duration-1000 \${progressPercent === 100 ? 'bg-green-500' : 'bg-[var(--accent)]'}\`} 
                style={{ width: \`\${progressPercent}%\` }}
              ></div>
            </div>
          </div>
        );
      }, [group.products, areaFilter])}
`);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('OrderCard.jsx optimizado con React.memo y useMemo.');
