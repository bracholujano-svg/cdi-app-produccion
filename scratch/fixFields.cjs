const fs = require('fs');
let code = fs.readFileSync('src/components/modals/PlantPlannerModal.jsx', 'utf8');

code = code.replace(
    /item\.descripcion \|\| 'SIN DESCRIPCIÓN'/g,
    "item.nombre || 'SIN NOMBRE'"
);

code = code.replace(
    /COD: \{item\.articulo\}/g,
    "COD: {item.codArticulo || 'SIN CÓDIGO'}"
);

fs.writeFileSync('src/components/modals/PlantPlannerModal.jsx', code);
console.log('Done');
