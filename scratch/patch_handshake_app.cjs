const fs = require('fs');

function patchApp() {
    const p = 'src/App.jsx';
    let content = fs.readFileSync(p, 'utf8');

    const exactMatch = `  const updateTransfer = (id, area, date, en, re) => {
    const order = orders.find(o => o?.id === id);
    if (!order) return;
    const newHistoryEntry = { fecha: new Date().toISOString(), supervisor: supervisorProfile?.name || "S/N", accion: \`Entrega a \${area}\`, entrega: en, recibe: re, nota: transferNota, foto: transferPhoto };
    const updatedOrder = { ...order, areaActual: area, estadoInterno: CONFIG_PROCESOS[area]?.[0] || "En Espera", fechaEntregaPrometida: date, historial: [...(order.historial || []), newHistoryEntry] };
    let newOrdersList = orders.map(o => o?.id === id ? updatedOrder : o);
    
    if (updatedOrder.estadoInterno === 'DESPACHADO' || area === 'Despachos') {
        const sameOrderProducts = newOrdersList.filter(o => o?.pedidoNum === updatedOrder.pedidoNum);
        const allDispatched = sameOrderProducts.every(p => p?.estadoInterno === 'DESPACHADO' || p?.areaActual === 'Despachos');
        if (allDispatched) {
            const alertObj = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (updatedOrder.pedidoNum || "").toUpperCase());
            if (alertObj) {
                const newAlerts = coordinationAlerts.filter(a => a?.id !== alertObj.id);
                setCoordinationAlerts(newAlerts);
                syncAlertToSupabase(alertObj, true);
            }
        }
    }

    setOrders(newOrdersList); setSelectedOrder(null); syncOrderToSupabase(updatedOrder);
    setTransferNota(""); setTransferPhoto(null);
  };`;

    // Try a regex to match it just in case spaces differ
    const regexOldUpdateTransfer = /const updateTransfer = \(id, area, date, en, re\) => \{[\s\S]*?setTransferNota\(""\); setTransferPhoto\(null\);\r?\n  \};/;

    const newTransferLogic = `  const updateTransfer = (id, area, date, en) => {
    const order = orders.find(o => o?.id === id);
    if (!order) return;
    
    // El Handshake: En lugar de moverlo de areaActual, lo marcamos como "esperando recepción"
    const pendingObj = {
      haciaArea: area,
      fechaEnvio: new Date().toISOString(),
      entregadoPor: en,
      nota: transferNota,
      fotoEntrega: transferPhoto,
      fechaEntregaPrometidaGuardada: date
    };

    const updatedOrder = { 
        ...order, 
        transferenciaPendiente: pendingObj,
        estadoInterno: \`ESPERANDO RECEPCIÓN EN \${area.toUpperCase()}\`,
        fechaEntregaPrometida: date // La actualizamos de una vez
    };

    const newOrdersList = orders.map(o => o?.id === id ? updatedOrder : o);
    setOrders(newOrdersList); setSelectedOrder(null); syncOrderToSupabase(updatedOrder);
    setTransferNota(""); setTransferPhoto(null);
  };

  const processReception = (id, isAccepted, receiverName, notes, photo) => {
    const order = orders.find(o => o?.id === id);
    if (!order || !order.transferenciaPendiente) return;

    const { haciaArea, entregadoPor, fotoEntrega, nota: notaEntrega } = order.transferenciaPendiente;
    let updatedOrder = { ...order };
    delete updatedOrder.transferenciaPendiente; // Limpiamos la cola

    if (isAccepted) {
        // Handshake completado
        const newHistoryEntry = { 
            fecha: new Date().toISOString(), 
            supervisor: supervisorProfile?.name || "S/N", 
            accion: \`Entrega a \${haciaArea}\`, 
            entrega: entregadoPor, 
            recibe: receiverName, 
            nota: \`Solicitud: \${notaEntrega || 'S/N'}. Recepción: \${notes || 'S/N'}\`, 
            foto: photo || fotoEntrega 
        };
        
        updatedOrder.areaActual = haciaArea;
        updatedOrder.estadoInterno = CONFIG_PROCESOS[haciaArea]?.[0] || "En Espera";
        updatedOrder.historial = [...(order.historial || []), newHistoryEntry];
        
        // Dispatch check
        if (updatedOrder.estadoInterno === 'DESPACHADO' || haciaArea === 'Despachos') {
            const sameOrderProducts = orders.filter(o => o?.pedidoNum === updatedOrder.pedidoNum && o.id !== updatedOrder.id);
            const allOthersDispatched = sameOrderProducts.every(p => p?.estadoInterno === 'DESPACHADO' || p?.areaActual === 'Despachos');
            if (allOthersDispatched || sameOrderProducts.length === 0) {
                const alertObj = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (updatedOrder.pedidoNum || "").toUpperCase());
                if (alertObj) {
                    const newAlerts = coordinationAlerts.filter(a => a?.id !== alertObj.id);
                    setCoordinationAlerts(newAlerts);
                    syncAlertToSupabase(alertObj, true);
                }
            }
        }
    } else {
        // Handshake RECHAZADO
        const newHistoryEntry = { 
            fecha: new Date().toISOString(), 
            supervisor: supervisorProfile?.name || "S/N", 
            accion: \`Rechazo desde \${haciaArea}\`, 
            entrega: entregadoPor, 
            recibe: receiverName, 
            nota: \`MOTIVO DE RECHAZO: \${notes}\`, 
            foto: photo || fotoEntrega 
        };
        
        updatedOrder.estadoInterno = \`RECHAZADO POR \${haciaArea.toUpperCase()}\`;
        updatedOrder.historial = [...(order.historial || []), newHistoryEntry];
    }

    const newOrdersList = orders.map(o => o?.id === id ? updatedOrder : o);
    setOrders(newOrdersList); syncOrderToSupabase(updatedOrder);
  };`;

    if (regexOldUpdateTransfer.test(content)) {
        content = content.replace(regexOldUpdateTransfer, newTransferLogic);
        console.log("Successfully replaced updateTransfer using Regex.");
    } else if (content.includes(exactMatch)) {
        content = content.replace(exactMatch, newTransferLogic);
        console.log("Successfully replaced updateTransfer using exact string match.");
    } else {
        console.log("Could not find updateTransfer block to replace. Here is the block it searched for:");
        console.log("-------------------");
        const match = content.match(/const updateTransfer = [\s\S]*?setTransferPhoto\(null\);\r?\n  \};/);
        if(match) console.log(match[0]);
    }

    fs.writeFileSync(p, content, 'utf8');
}

try {
    patchApp();
} catch(e) {
    console.error(e);
}
