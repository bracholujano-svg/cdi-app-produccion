const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderDetailsModal.jsx', 'utf8');

code = code.replace(
    'const [isTerminadoLocal, setIsTerminadoLocal] = React.useState(false);',
    'const [isTerminadoLocal, setIsTerminadoLocal] = React.useState(false);\n  const [tempPartialQty, setTempPartialQty] = React.useState(0);'
);

fs.writeFileSync('src/components/orders/OrderDetailsModal.jsx', code);
