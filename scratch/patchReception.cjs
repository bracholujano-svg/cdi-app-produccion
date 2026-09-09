const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const regex = /const processReception = async \(pedidoNum, isTotal = true\) => \{[\s\S]*?const addItemToCoordList = \(\) => \{/;

const replacement = `const processReception = async (pedidoNum, isTotal = true, receptionName, receptionNotes, tempPhoto) => {
    try {
        const ids = Array.isArray(pedidoNum) ? pedidoNum : [pedidoNum];
        const { updatedOrders, updatedAlerts, ordersToSync, alertsToSync } = executeReception(ids, {
            orders,
            coordinationAlerts,
            supervisorName: supervisorProfile?.name || 'Desconocido',
            accepted: isTotal,
            receptionName: receptionName || supervisorProfile?.name || 'Desconocido',
            notes: receptionNotes || '',
            photo: tempPhoto || null
        });

        if (updatedOrders) setOrders(updatedOrders);
        if (updatedAlerts) setCoordinationAlerts(updatedAlerts);
        
        for (const o of (ordersToSync || [])) await syncOrderToSupabase(o);
        for (const a of (alertsToSync || [])) await syncAlertToSupabase(a);
    } catch (err) {
        alert('Error en recepción: ' + err.message);
    }
  };

  const processBulkReception = async (pedidos, isTotal = true, receptionName, receptionNotes, tempPhoto) => {
    await processReception(pedidos, isTotal, receptionName, receptionNotes, tempPhoto);
  };

  const addItemToCoordList = () => {`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/App.jsx', code);
