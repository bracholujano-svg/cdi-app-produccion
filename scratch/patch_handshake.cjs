const fs = require('fs');

function patchAppContext() {
    const p = 'src/context/AppContext.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Add state declaration
    content = content.replace(
        "const [showDashboardModal, setShowDashboardModal] = useState(false);",
        "const [showDashboardModal, setShowDashboardModal] = useState(false);\n  const [showReceptionModal, setShowReceptionModal] = useState(false);"
    );

    // Add to export
    content = content.replace(
        "showDashboardModal, setShowDashboardModal,",
        "showDashboardModal, setShowDashboardModal,\n    showReceptionModal, setShowReceptionModal,"
    );

    fs.writeFileSync(p, content, 'utf8');
}

function patchHeader() {
    const p = 'src/components/layout/Header.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Extract setShowReceptionModal
    content = content.replace(
        "setShowReportConfigModal,",
        "setShowReportConfigModal,\n    showReceptionModal, setShowReceptionModal,"
    );

    // Filter pending receptions for current area
    const countLogic = `
  const pendingReceptions = orders.filter(o => 
    o?.transferenciaPendiente && 
    (areaFilter === 'Todas' || o.transferenciaPendiente.haciaArea === areaFilter)
  ).length;

  return (`;
  
    content = content.replace("return (", countLogic);

    // Inject bell icon near LogOut
    const bellIcon = `
            <div className="flex items-center gap-2 md:gap-4">
              <button onClick={() => setShowReceptionModal(true)} className="p-2 md:p-3 rounded-xl bg-black/5 hover:bg-[var(--primary)] hover:text-white transition-all text-gray-500 relative">
                <Bell size={"1.2em"} />
                {pendingReceptions > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce shadow-md">
                    {pendingReceptions}
                  </span>
                )}
              </button>
              <button onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')}`;
              
    content = content.replace(
        `<div className="flex items-center gap-2 md:gap-4">\n              <button onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')}`,
        bellIcon
    );

    fs.writeFileSync(p, content, 'utf8');
}

function patchOrderDetailsModal() {
    const p = 'src/components/orders/OrderDetailsModal.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Remove "Recibido por"
    content = content.replace(
        `                                  <div>
                                      <label className="block text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-gray-400 mb-1 uppercase">Recibido Por (Nombre / Firma):</label>
                                      <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl p-3">
                                          <UserCheck size={"1.2em"} className="theme-text-muted" />
                                          <input id="recibidoPor" type="text" className="w-full bg-transparent text-xs md:text-sm lg:text-base font-bold outline-none uppercase" placeholder="Ej. PEDRO PÉREZ" defaultValue="" />
                                      </div>
                                  </div>`,
        ""
    );

    // Change button logic
    content = content.replace(
        `                              const en = document.getElementById('entregadoPor').value.trim().toUpperCase();\n                              const re = document.getElementById('recibidoPor').value.trim().toUpperCase();\n                              if(en && re && tempTransferDate) updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en, re);\n                          }} className="w-full bg-[var(--accent)] text-[var(--card-bg)] py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--border-color)] transition-all duration-200 hover:brightness-125 active:scale-95">Confirmar Entrega de Sección</button>`,
        `                              const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                              if(en && tempTransferDate) {
                                  updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en);
                                  setSelectedOrder(null); // Cerrar al enviar solicitud
                              } else {
                                  alert("Ingrese su nombre para solicitar la entrega.");
                              }
                          }} className="w-full bg-yellow-500 text-yellow-950 py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm transition-all duration-200 hover:brightness-125 active:scale-95">Enviar Solicitud de Entrega</button>`
    );

    fs.writeFileSync(p, content, 'utf8');
}

function patchApp() {
    const p = 'src/App.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Import ReceptionModal
    content = content.replace(
        "import OrderDetailsModal from './components/orders/OrderDetailsModal';",
        "import OrderDetailsModal from './components/orders/OrderDetailsModal';\nimport ReceptionModal from './components/orders/ReceptionModal';"
    );

    // Extract new state from AppContext
    content = content.replace(
        "showDashboardModal, setShowDashboardModal,",
        "showDashboardModal, setShowDashboardModal,\n    showReceptionModal,"
    );

    // Rewrite updateTransfer to initiateTransfer
    const oldUpdateTransferStr = `  const updateTransfer = (id, area, date, en, re) => {
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
    
    setOrders(newOrdersList); setSelectedOrder(updatedOrder); syncOrderToSupabase(updatedOrder);
    setTransferNota(""); setTransferPhoto(null);
  };`;

    const newTransferLogic = `
  const updateTransfer = (id, area, date, en) => {
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
    setOrders(newOrdersList); syncOrderToSupabase(updatedOrder);
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

    content = content.replace(oldUpdateTransferStr, newTransferLogic);

    // Inject ReceptionModal near OrderDetailsModal
    content = content.replace(
        "        <OrderDetailsModal ",
        "        <ReceptionModal processReception={processReception} />\n\n        <OrderDetailsModal "
    );

    fs.writeFileSync(p, content, 'utf8');
}

try {
    patchAppContext();
    patchHeader();
    patchOrderDetailsModal();
    patchApp();
    console.log("Patched Handshake logic successfully.");
} catch(e) {
    console.error(e);
}
