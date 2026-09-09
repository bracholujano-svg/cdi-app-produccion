const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const regex = /const updateTransfer = async \(id, areas, date, operario, _, isPartial\) => \{[\s\S]*?setTransferPhoto\(null\);\s*\};/;

const replacement = `const updateTransfer = async (id, areas, date, operario, _, isPartial) => {
    try {
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
    } catch (err) {
        alert('Error en transferencia: ' + err.message);
    }
  };`;

code = code.replace(regex, replacement);

fs.writeFileSync('src/App.jsx', code);
