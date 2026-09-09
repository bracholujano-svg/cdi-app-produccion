const fs = require('fs');
let code = fs.readFileSync('src/components/orders/BulkOrderDetailsModal.jsx', 'utf8');

code = code.replace(
    "const en = document.getElementById('entregadoPor').value.trim().toUpperCase();",
    "const en = document.getElementById('entregadoPorBulk').value.trim().toUpperCase();"
);

fs.writeFileSync('src/components/orders/BulkOrderDetailsModal.jsx', code);
