const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'orders', 'OrderDetailsModal.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

const insecureLine = "const canEdit = areaFilter === 'Administrador / Todos' || areaFilter === 'Todas' || String(areaFilter || '').trim() === String(selectedOrder.areaActual).trim();";
const secureLine = "const canEdit = supervisorProfile?.area === 'Administrador / Todos' || String(supervisorProfile?.area || '').trim() === String(selectedOrder.areaActual).trim();";

if (content.includes(insecureLine)) {
    content = content.replaceAll(insecureLine, secureLine);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Fallo de seguridad canEdit solucionado.');
} else {
    console.log('No se encontró la línea insecureLine.');
}
