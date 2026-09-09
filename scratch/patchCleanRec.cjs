const fs = require('fs');
let code = fs.readFileSync('src/services/OrderOperationsService.js', 'utf8');

const regexRec = /const targetArea = order\.transferenciaPendiente\.haciaArea;\s*const isPartial = order\.transferenciaPendiente\.isPartial;[\s\S]*?ordersToSync\.push\(updatedOrder\);/g;

const replaceRec = `const targetArea = order.transferenciaPendiente.haciaArea;
        
        const newHistoryEntry = {
            fecha: new Date().toISOString(),
            supervisor: supervisorName || "S/N",
            accion: isReject ? \`Rechazo de \${targetArea}\` : \`Recepción en \${targetArea}\`,
            entrega: order.transferenciaPendiente.entregadoPor,
            recibe: receptionName,
            nota: notes,
            foto: photo
        };
        
        const updatedOrder = isReject
            ? {
                ...order,
                estadoInterno: \`RECHAZADO POR \${targetArea}\`,
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
        ordersToSync.push(updatedOrder);`;

code = code.replace(regexRec, replaceRec);

fs.writeFileSync('src/services/OrderOperationsService.js', code);
