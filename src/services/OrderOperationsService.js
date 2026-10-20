import { CONFIG_PROCESOS } from '../utils/constants';

/**
 * Checks if all products associated with a target order are fully dispatched,
 * and if so, prepares the associated coordination alert to be deleted.
 */
const _checkDispatchedAlert = (targetOrder, newOrdersList, coordinationAlerts) => {
    let alertsToSync = [];
    let updatedAlerts = null;

    if (targetOrder.estadoInterno === 'DESPACHADO') {
        const sameOrderProducts = newOrdersList.filter(o => o?.pedidoNum === targetOrder.pedidoNum);
        const allDispatched = sameOrderProducts.every(p => p?.estadoInterno === 'DESPACHADO');
        
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
    partialQty,
    tempAssignedPersonnel,
    transferNota,
    transferPhoto,
    logisticaData = null
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
        
        let order = newOrdersList[orderIndex];

        // LOGIC FOR PARTIAL DELIVERY / PARTS TO ONE OR MULTIPLE AREAS:
        // If it's a partial delivery (isPartial is true), we CLONE the product for each target area
        // so the original stays in the current area while parts travel simultaneously to the target areas.
        let doPartialClone = Boolean(isPartial) && areas.length >= 1;

        if (doPartialClone) {
            const pQty = partialQty ? parseInt(partialQty) : null;
            const validQtySplit = areas.length === 1 && pQty && pQty > 0 && pQty < (order.cantidad || 99999);
            const originalQty = validQtySplit ? (order.cantidad - pQty) : order.cantidad;
            const transferQty = validQtySplit ? pQty : order.cantidad;
            const qtyText = validQtySplit ? ` (${pQty} unds)` : " (Partes)";

            const areasSummaryText = areas.join(', ');
            const originalHistoryEntry = {
                fecha: new Date().toISOString(),
                supervisor: supervisorName || "S/N",
                accion: `Entrega Parcial a ${areasSummaryText}${qtyText}`,
                entrega: entrega,
                recibe: recibe,
                nota: transferNota,
                foto: transferPhoto
            };

            // Update original (stays in current area)
            const updatedOriginal = {
                ...order,
                cantidad: originalQty,
                historial: [...(order.historial || []), originalHistoryEntry]
            };
            newOrdersList[orderIndex] = updatedOriginal;
            ordersToSync.push(updatedOriginal);

            // Create clone for each target area (travels simultaneously to new areas)
            areas.forEach(area => {
                const cloneId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
                const isDespacho = area === 'Despachos';
                const personalAsignado = tempAssignedPersonnel[area] || [];
                const asignadoText = personalAsignado.length > 0 ? ` (Asignado a: ${personalAsignado.join(', ')})` : "";

                const newHistoryEntry = { 
                    fecha: new Date().toISOString(), 
                    supervisor: supervisorName || "S/N", 
                    accion: `Entrega Parcial a ${area}${asignadoText}${qtyText}`, 
                    entrega: entrega, 
                    recibe: recibe, 
                    nota: transferNota, 
                    foto: transferPhoto 
                };

                let targetOrder = isDespacho 
                    ? { 
                        ...order, 
                        id: cloneId,
                        master_id: order.master_id || order.id,
                        cantidad: transferQty,
                        areaActual: 'Despachos', 
                        estadoInterno: 'EN ESPERA', 
                        fechaEntregaPrometida: date || order.fechaEntregaPrometida,
                        asignado_a: personalAsignado,
                        isTerminado: false, 
                        datos_logistica: null,
                        transferenciaPendiente: null,
                        historial: [...(order.historial || []), newHistoryEntry] 
                    }
                    : { 
                        ...order,
                        id: cloneId,
                        master_id: order.master_id || order.id,
                        cantidad: transferQty,
                        areaActual: order.areaActual,
                        estadoInterno: `ENTREGA PARCIAL EN TRÁNSITO A ${area}`,
                        fechaEntregaPrometida: date,
                        asignado_a: personalAsignado,
                        transferenciaPendiente: {
                            haciaArea: area,
                            entregadoPor: entrega || supervisorName || "S/N",
                            nota: transferNota,
                            fotoEntrega: transferPhoto,
                            fechaEnvio: new Date().toISOString(),
                            isPartial: true
                        },
                        isTerminado: false, 
                        historial: [...(order.historial || []), newHistoryEntry] 
                    };
                
                newOrdersList.push(targetOrder);
                ordersToSync.push(targetOrder);

                const { updatedAlerts, alertsToSync } = _checkDispatchedAlert(targetOrder, newOrdersList, currentAlerts);
                if (updatedAlerts) {
                    currentAlerts = updatedAlerts;
                    updatedAlertsObj = updatedAlerts;
                    allAlertsToSync = [...allAlertsToSync, ...alertsToSync];
                }
            });

            return; // Done with this product
        }

        // NORMAL TRANSFER OR BIFURCATION (Multiple areas)
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
                        areaActual: 'Despachos', 
                        estadoInterno: 'EN ESPERA', 
                        fechaEntregaPrometida: date || order.fechaEntregaPrometida,
                        asignado_a: personalAsignado,
                        isTerminado: false, 
                        datos_logistica: null,
                        transferenciaPendiente: null,
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
                        areaActual: 'Despachos', 
                        estadoInterno: 'EN ESPERA', 
                        fechaEntregaPrometida: date || order.fechaEntregaPrometida,
                        asignado_a: personalAsignado,
                        isTerminado: false, 
                        datos_logistica: null,
                        transferenciaPendiente: null,
                        historial: [...(order.historial || []), { 
                            ...newHistoryEntry, 
                            accion: `Bifurcación hacia Despachos${asignadoText}` 
                        }] 
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

/**
 * Ejecución del Despacho Logístico Final (Salida de Planta).
 * Este es el ÚNICO método que actualiza el estado terminal 'DESPACHADO',
 * registra los datos de transporte y chofer, y marca el ítem como terminado.
 */
export const executeDispatch = (ids, {
    orders,
    coordinationAlerts,
    supervisorName,
    date,
    logisticaData,
    nota,
    foto
}) => {
    if (!ids || ids.length === 0) {
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

        const historyEntry = {
            fecha: new Date().toISOString(),
            supervisor: supervisorName || "S/N",
            accion: "Despacho Final de Planta (Salida)",
            entrega: supervisorName || "S/N",
            recibe: logisticaData?.nombreChofer || "Transporte",
            nota: nota || "",
            foto: foto || null,
            logistica: logisticaData || null
        };

        const dispatchedOrder = {
            ...order,
            areaActual: 'Despachos',
            estadoInterno: 'DESPACHADO',
            isTerminado: true,
            fechaDespacho: date || new Date().toISOString(),
            datos_logistica: logisticaData || null,
            transferenciaPendiente: null,
            historial: [...(order.historial || []), historyEntry]
        };

        newOrdersList[orderIndex] = dispatchedOrder;
        ordersToSync.push(dispatchedOrder);

        const { updatedAlerts, alertsToSync } = _checkDispatchedAlert(dispatchedOrder, newOrdersList, currentAlerts);
        if (updatedAlerts) {
            currentAlerts = updatedAlerts;
            updatedAlertsObj = updatedAlerts;
            allAlertsToSync = [...allAlertsToSync, ...alertsToSync];
        }
    });

    return {
        updatedOrders: newOrdersList,
        updatedAlerts: updatedAlertsObj,
        ordersToSync,
        alertsToSync: allAlertsToSync
    };
};
