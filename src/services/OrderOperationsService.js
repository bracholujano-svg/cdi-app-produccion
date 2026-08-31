import { CONFIG_PROCESOS } from '../utils/constants';

/**
 * Checks if all products associated with a target order are fully dispatched,
 * and if so, prepares the associated coordination alert to be deleted.
 */
const _checkDispatchedAlert = (targetOrder, newOrdersList, coordinationAlerts) => {
    let alertsToSync = [];
    let updatedAlerts = null;

    if (targetOrder.estadoInterno === 'DESPACHADO' || targetOrder.areaActual === 'Despachos') {
        const sameOrderProducts = newOrdersList.filter(o => o?.pedidoNum === targetOrder.pedidoNum);
        const allDispatched = sameOrderProducts.every(p => p?.estadoInterno === 'DESPACHADO' || p?.areaActual === 'Despachos');
        
        if (allDispatched) {
            const alertObj = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (targetOrder.pedidoNum || "").toUpperCase());
            if (alertObj) {
                updatedAlerts = coordinationAlerts.filter(a => a?.id !== alertObj.id);
                alertsToSync.push(alertObj);
            }
        }
    }

    return { updatedAlerts, alertsToSync };
};

export const executeTransfer = (ids, {
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
    let updatedAlertsObj = null;

    ids.forEach((id) => {
        const orderIndex = newOrdersList.findIndex(o => o?.id === id);
        if (orderIndex === -1) return;
        
        const order = newOrdersList[orderIndex];

        areas.forEach((area, index) => {
            const isDespacho = area === 'Despachos';
            const personalAsignado = tempAssignedPersonnel[area] || [];
            const asignadoText = personalAsignado.length > 0 ? ` (Asignado a: ${personalAsignado.join(', ')})` : "";
            
            const newHistoryEntry = { 
                fecha: new Date().toISOString(), 
                supervisor: supervisorName || "S/N", 
                accion: isPartial ? `Entrega Parcial a ${area}${asignadoText}` : `Entrega a ${area}${asignadoText}`, 
                entrega: entrega, 
                recibe: recibe, 
                nota: transferNota, 
                foto: transferPhoto 
            };
            
            let targetOrder;
            
            if (index === 0) {
                // Update the original master
                targetOrder = isDespacho 
                    ? { 
                        ...order, 
                        areaActual: area, 
                        estadoInterno: 'En Espera', 
                        fechaEntregaPrometida: date,
                        asignado_a: personalAsignado,
                        isTerminado: false, 
                        historial: [...(order.historial || []), newHistoryEntry] 
                    }
                    : { 
                        ...order, 
                        estadoInterno: isPartial ? `ENTREGA PARCIAL EN TRÁNSITO A ${area}` : `EN TRÁNSITO A ${area}`,
                        fechaEntregaPrometida: date,
                        asignado_a: personalAsignado,
                        transferenciaPendiente: {
                            haciaArea: area,
                            entregadoPor: entrega || supervisorName || "S/N",
                            nota: transferNota,
                            fotoEntrega: transferPhoto,
                            fechaEnvio: new Date().toISOString(),
                            isPartial: isPartial
                        },
                        isTerminado: false, 
                        historial: [...(order.historial || []), newHistoryEntry] 
                    };
                    
                newOrdersList[newOrdersList.findIndex(o => o?.id === id)] = targetOrder;
            } else {
                // Bifurcation (Clones)
                const cloneId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
                targetOrder = isDespacho 
                    ? { 
                        ...order, 
                        id: cloneId,
                        master_id: order.id,
                        areaActual: area, 
                        estadoInterno: 'En Espera', 
                        fechaEntregaPrometida: date,
                        asignado_a: personalAsignado,
                        isTerminado: false, 
                        historial: [...(order.historial || []), { ...newHistoryEntry, accion: `Bifurcación hacia ${area}${asignadoText}` }] 
                    }
                    : { 
                        ...order,
                        id: cloneId,
                        master_id: order.id,
                        areaActual: order.areaActual,
                        estadoInterno: `EN TRÁNSITO A ${area}`,
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
                        historial: [...(order.historial || []), { ...newHistoryEntry, accion: `Bifurcación hacia ${area}${asignadoText}` }] 
                    };
                
                newOrdersList.push(targetOrder);
            }
            
            ordersToSync.push(targetOrder);

            // Sync alerts if dispatched
            const { updatedAlerts, alertsToSync } = _checkDispatchedAlert(targetOrder, newOrdersList, currentAlerts);
            if (updatedAlerts) {
                currentAlerts = updatedAlerts;
                updatedAlertsObj = updatedAlerts;
                allAlertsToSync = [...allAlertsToSync, ...alertsToSync];
            }
        });
    });

    return {
        updatedOrders: newOrdersList,
        updatedAlerts: updatedAlertsObj,
        ordersToSync,
        alertsToSync: allAlertsToSync
    };
};

export const executeReception = (ids, {
    orders,
    coordinationAlerts,
    supervisorName,
    accepted,
    receptionName,
    notes,
    photo
}) => {
    if (!ids || ids.length === 0) {
        return { updatedOrders: orders, updatedAlerts: null, ordersToSync: [], alertsToSync: [] };
    }

    let newOrdersList = [...orders];
    const ordersToSync = [];
    let currentAlerts = [...coordinationAlerts];
    let allAlertsToSync = [];
    let updatedAlertsObj = null;
    
    const isReject = !accepted;

    ids.forEach((id) => {
        const orderIndex = newOrdersList.findIndex(o => o?.id === id);
        if (orderIndex === -1) return;
        
        const order = newOrdersList[orderIndex];
        if (!order.transferenciaPendiente) return;

        const targetArea = order.transferenciaPendiente.haciaArea;
        
        const newHistoryEntry = {
            fecha: new Date().toISOString(),
            supervisor: supervisorName || "S/N",
            accion: isReject ? `Rechazo de ${targetArea}` : `Recepción en ${targetArea}`,
            entrega: order.transferenciaPendiente.entregadoPor,
            recibe: receptionName,
            nota: notes,
            foto: photo
        };
        
        const updatedOrder = isReject
            ? {
                ...order,
                estadoInterno: `RECHAZADO POR ${targetArea}`,
                transferenciaPendiente: null,
                isTerminado: false, 
                historial: [...(order.historial || []), newHistoryEntry]
            }
            : {
                ...order,
                areaActual: targetArea,
                areas_compartidas: [],
                estadoInterno: CONFIG_PROCESOS[targetArea]?.[0] || "En Espera",
                transferenciaPendiente: null,
                isTerminado: false, 
                historial: [...(order.historial || []), newHistoryEntry]
            };
            
        newOrdersList[orderIndex] = updatedOrder;
        ordersToSync.push(updatedOrder);
        
        if (!isReject && targetArea === 'Despachos') {
            const { updatedAlerts, alertsToSync } = _checkDispatchedAlert(updatedOrder, newOrdersList, currentAlerts);
            if (updatedAlerts) {
                currentAlerts = updatedAlerts;
                updatedAlertsObj = updatedAlerts;
                allAlertsToSync = [...allAlertsToSync, ...alertsToSync];
            }
        }
    });

    return {
        updatedOrders: newOrdersList,
        updatedAlerts: updatedAlertsObj,
        ordersToSync,
        alertsToSync: allAlertsToSync
    };
};
