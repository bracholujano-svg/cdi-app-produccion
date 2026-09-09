const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const startIdx = code.indexOf('const updateTransfer = async (id, areas) => {');
const endIdx = code.indexOf('const processReception = async (pedidoNum, isTotal = true) => {');

if (startIdx !== -1 && endIdx !== -1) {
    const newCode = `  const updateTransfer = async (id, areas, date, operario, _, isPartial) => {
    const ids = Array.isArray(id) ? id : [id];
    const { updatedOrders, updatedAlerts, ordersToSync, alertsToSync } = executeTransfer(ids, {
        orders,
        coordinationAlerts,
        supervisorName: operario || supervisorProfile?.name || 'Desconocido',
        areas: Array.isArray(areas) ? areas : [areas],
        date: date || new Date().toISOString(),
        entrega: operario || supervisorProfile?.name || 'Desconocido',
        recibe: '',
        isPartial: isPartial,
        tempAssignedPersonnel,
        transferNota,
        transferPhoto
    });

    if (updatedOrders) setOrders(updatedOrders);
    if (updatedAlerts) setCoordinationAlerts(updatedAlerts);
    
    for (const o of (ordersToSync || [])) await syncOrderToSupabase(o);
    for (const a of (alertsToSync || [])) await syncAlertToSupabase(a);
    
    setTempAssignedPersonnel({});
    setTransferNota('');
    setTransferPhoto(null);
  };

  const handleBulkTransfer = async (ids, areas, date, operario, _, isPartial) => {
    await updateTransfer(ids, areas, date, operario, _, isPartial);
    setShowBulkModal(false);
  };

  `;
    code = code.substring(0, startIdx) + newCode + code.substring(endIdx);
    fs.writeFileSync('src/App.jsx', code);
    console.log('Successfully patched transfers');
} else {
    console.log('Could not find boundaries');
}
