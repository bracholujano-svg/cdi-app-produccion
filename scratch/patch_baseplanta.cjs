const fs = require('fs');

const path = 'src/components/modals/AdvancedExecutiveDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    "const basePlanta = totalOrders; // Población Total de la Planta\n    const itemsInspeccionados = itemsAprobados + itemsRechazados + itemsRetrabajo;",
    "const itemsInspeccionados = itemsAprobados + itemsRechazados + itemsRetrabajo;"
);

fs.writeFileSync(path, content, 'utf8');
console.log("Duplicate basePlanta removed.");
