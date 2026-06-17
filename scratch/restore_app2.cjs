const fs = require('fs');
const path = require('path');

const appFilePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(appFilePath, 'utf8');

const mangledStart = content.indexOf('  const filteredOrders = orders.filter(o => {');
const mangledEnd = content.indexOf('    if (!supervisorProfile) return <LoginScreen />;');

if (mangledStart !== -1 && mangledEnd !== -1) {
    const part1 = content.substring(0, mangledStart);
    const part3 = content.substring(mangledEnd);
    
    const correctCode = `  const filteredOrders = orders.filter(o => {
    if (!o) return false;
    
    const st = searchTerm.toLowerCase().trim();
    const searchTerms = st ? st.split(/\\s+/) : [];
    
    const matchSearch = searchTerms.length === 0 || searchTerms.every(term => 
        (String(o.pedidoNum || "")).toLowerCase().includes(term) || 
        (String(o.nombre || "")).toLowerCase().includes(term) || 
        (String(o.codArticulo || "")).toLowerCase().includes(term) ||
        (String(o.cliente || "")).toLowerCase().includes(term)
    );

    const matchArea = areaFilter === 'Todas' || o.areaActual === areaFilter;
    
    let resolvedDate = o.fechaEntregaPrometida;
    const alertMatch = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (o.pedidoNum || "").toUpperCase());
    if (alertMatch && alertMatch.fechaEntrega) resolvedDate = alertMatch.fechaEntrega;

    if (viewFilter === 'ATRASADOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(resolvedDate) !== null && getDaysLeft(resolvedDate) < 0;
    if (viewFilter === 'CUMPLIDOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && (getDaysLeft(resolvedDate) === null || getDaysLeft(resolvedDate) >= 0);
    if (viewFilter === 'DESPACHADOS') return matchSearch && matchArea && o.estadoInterno === 'DESPACHADO';
    return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO';
  });

  const groupedOrders = useMemo(() => filteredOrders.reduce((acc, order) => {
    if (!order) return acc;
    const pNum = order.pedidoNum || "S/N";
    
    let resolvedDate = order.fechaEntregaPrometida;
    const alertMatch = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === pNum.toUpperCase());
    if (alertMatch && alertMatch.fechaEntrega) resolvedDate = alertMatch.fechaEntrega;

    if (!acc[pNum]) acc[pNum] = { pedidoNum: pNum, cliente: order.cliente, fechaEntregaPrometida: resolvedDate, products: [] };
    else if (!acc[pNum].fechaEntregaPrometida && resolvedDate) acc[pNum].fechaEntregaPrometida = resolvedDate;
    
    acc[pNum].products.push(order);
    return acc;
  }, {}), [filteredOrders, coordinationAlerts]);
  
  const groupedArray = useMemo(() => Object.values(groupedOrders), [groupedOrders]);
  const activeGroupObj = groupedArray.find(g => g?.pedidoNum === selectedGroupPedido) || null;

  let gridColsClass = 'grid-cols-1 md:grid-cols-3';
  if (gridColumns === 2) gridColsClass = 'grid-cols-2 lg:grid-cols-3';
  if (gridColumns === 3) gridColsClass = 'grid-cols-3 lg:grid-cols-3';
  if (gridColumns === 4) gridColsClass = 'grid-cols-3 lg:grid-cols-4';
  if (gridColumns === 5) gridColsClass = 'grid-cols-3 lg:grid-cols-5';

`;

    fs.writeFileSync(appFilePath, part1 + correctCode + part3, 'utf8');
    console.log("App.jsx restaurado perfectamente con fechas dinamicas.");
} else {
    console.log("Indices no encontrados.");
}
