const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(
    'const ids = Array.isArray(pedidoNum) ? pedidoNum : [pedidoNum];',
    'const ids = Array.isArray(pedidoNum) ? pedidoNum : [pedidoNum];\n        alert("Recibiendo: " + ids.length);'
);

code = code.replace(
    'const ids = Array.isArray(id) ? id : [id];',
    'const ids = Array.isArray(id) ? id : [id];\n        alert("Transfiriendo bulk: " + ids.length);'
);

fs.writeFileSync('src/App.jsx', code);
