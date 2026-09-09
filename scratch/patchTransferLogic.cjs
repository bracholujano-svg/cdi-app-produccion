const fs = require('fs');
let code = fs.readFileSync('src/services/OrderOperationsService.js', 'utf8');

const regexTransfer = /export const executeTransfer = \([\s\S]*?return \{ updatedOrders: newOrdersList, updatedAlerts: currentAlerts, ordersToSync, alertsToSync: allAlertsToSync \};\n\};/g;

const replacementTransfer = `export const executeTransfer = (ids, {
    orders,
    coordinationAlerts,
    supervisorName,
    areas,
    date,
    entrega,
    recibe,
    isPartial,
    tempAssignedPersonnel,
    transferNota,
    transferPhoto
}) => {
    if (!ids || ids.length === 0 || !areas || areas.length === 0) {
        return { updatedOrders: orders, updatedAlerts: null, ordersToSync: [], alertsToSync: [] };
    }

    let newOrdersList = [...orders];
    const ordersToSync = [];
    let currentAlerts = [...coordinationAlerts];
    let allAlertsToSync = [];

    ids.forEach((id) => {
        const orderIndex = newOrdersList.findIndex(o => o?.id === id);
        if (orderIndex === -1) return;
        
        const order = newOrdersList[orderIndex];

        // If it's a numeric partial transfer
        if (typeof isPartial === 'number' && isPartial > 0 && isPartial < (order.cantidad || 99999)) {
            // Modify Original Order (Stays in current area with reduced quantity)
            const remainingQty = (order.cantidad || 0) - isPartial;
            const updatedOriginal = {
                ...order,
                cantidad: remainingQty,
                historial: [...(order.historial || []), {
                    fecha: new Date().toISOString(),
                    supervisor: supervisorName || "S/N",
                    accion: \`Fracción de lote separada (\${isPartial} unidades)\`,
                    entrega, recibe, nota: transferNota
                }]
            };
            newOrdersList[newOrdersList.findIndex(o => o?.id === id)] = updatedOriginal;
            ordersToSync.push(updatedOriginal);

            // Create Clones for target areas with the partial quantity
            areas.forEach((area) => {
                const cloneId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
                const personalAsignado = tempAssignedPersonnel[area] || [];
                const targetOrder = {
                    ...order,
                    id: cloneId,
                    master_id: order.id,
                    cantidad: isPartial,
                    estadoInterno: \`EN TRÁNSITO A \${area}\`,
                    fechaEntregaPrometida: date,
                    asignado_a: personalAsignado,
                    transferenciaPendiente: {
                        haciaArea: area,
                        entregadoPor: entrega || supervisorName || "S/N",
                        nota: transferNota,
                        fotoEntrega: transferPhoto,
                        fechaEnvio: new Date().toISOString(),
                        isPartial: false // It's no longer partial, it's a full order of smaller qty
                    },
                    isTerminado: false,
                    historial: [...(order.historial || []), {
                        fecha: new Date().toISOString(),
                        supervisor: supervisorName || "S/N",
                        accion: \`Fracción creada (\${isPartial} unidades) y enviada a \${area}\`,
                        entrega, recibe, nota: transferNota, foto: transferPhoto
                    }]
                };
                newOrdersList.push(targetOrder);
                ordersToSync.push(targetOrder);
            });
            return; // Skip normal full transfer logic
        }

        // Normal Full Transfer Logic (includes Bifurcation if multiple areas)
        areas.forEach((area, index) => {
            const personalAsignado = tempAssignedPersonnel[area] || [];
            const asignadoText = personalAsignado.length > 0 ? \` (Asignado a: \${personalAsignado.join(', ')})\` : "";
            
            const newHistoryEntry = { 
                fecha: new Date().toISOString(), 
                supervisor: supervisorName || "S/N", 
                accion: \`Entrega a \${area}\${asignadoText}\`, 
                entrega, recibe, nota: transferNota, foto: transferPhoto 
            };
            
            let targetOrder;
            if (index === 0) {
                targetOrder = { 
                    ...order, 
                    estadoInterno: \`EN TRÁNSITO A \${area}\`,
                    fechaEntregaPrometida: date,
                    asignado_a: personalAsignado,
                    transferenciaPendiente: {
                        haciaArea: area,
                        entregadoPor: entrega || supervisorName || "S/N",
                        nota: transferNota,
                        fotoEntrega: transferPhoto,
                        fechaEnvio: new Date().toISOString(),
                        isPartial: false
                    },
                    isTerminado: false, 
                    historial: [...(order.historial || []), newHistoryEntry] 
                };
                newOrdersList[newOrdersList.findIndex(o => o?.id === id)] = targetOrder;
            } else {
                const cloneId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
                targetOrder = { 
                    ...order,
                    id: cloneId,
                    master_id: order.id,
                    areaActual: order.areaActual,
                    estadoInterno: \`EN TRÁNSITO A \${area}\`,
                    fechaEntregaPrometida: date,
                    asignado_a: personalAsignado,
                    transferenciaPendiente: {
                        haciaArea: area,
                        entregadoPor: entrega || supervisorName || "S/N",
                        nota: transferNota,
                        fotoEntrega: transferPhoto,
                        fechaEnvio: new Date().toISOString(),
                        isPartial: false
                    },
                    isTerminado: false, 
                    historial: [...(order.historial || []), { ...newHistoryEntry, accion: \`Bifurcación hacia \${area}\${asignadoText}\` }] 
                };
                newOrdersList.push(targetOrder);
            }
            ordersToSync.push(targetOrder);
        });

        // Close Alerts
        currentAlerts.forEach(alert => {
            if (alert.pedidoNum === order.pedidoNum && alert.estado === 'pendiente') {
                alert.estado = 'resuelta';
                allAlertsToSync.push(alert);
            }
        });
    });

    return { updatedOrders: newOrdersList, updatedAlerts: currentAlerts, ordersToSync, alertsToSync: allAlertsToSync };
};`;

code = code.replace(regexTransfer, replacementTransfer);

fs.writeFileSync('src/services/OrderOperationsService.js', code);
