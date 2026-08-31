import { getDaysLeft } from '../utils/helpers';

export const calculatePlantMatrix = (orders) => {
    // 1. Filter out already dispatched orders
    const activeOrders = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && o.isTerminado !== true);
    
    // 2. Identify all areas
    const allAreas = new Set();
    activeOrders.forEach(o => allAreas.add(o.areaActual || 'Por Asignar'));
    
    // 3. Initialize matrix
    const matrix = {};
    Array.from(allAreas).forEach(area => {
        matrix[area] = {
            areaName: area,
            totalItems: 0,
            totalPedidos: 0,
            pedidosVencidos: 0,
            semaforoGeneral: 'green',
            pedidos: {}
        };
    });

    // 4. Populate Matrix with Orders and Items
    activeOrders.forEach(order => {
        const area = order.areaActual || 'Por Asignar';
        const pNum = order.pedidoNum || 'SIN_PEDIDO';
        
        if (!matrix[area].pedidos[pNum]) {
            matrix[area].pedidos[pNum] = {
                pedidoNum: pNum,
                cliente: order.cliente || 'Desconocido',
                fechaEntregaPrometida: order.fechaEntregaPrometida,
                diasRestantes: getDaysLeft(order.fechaEntregaPrometida),
                items: [],
                semaforo: 'green',
                alertReasons: []
            };
        }
        
        matrix[area].pedidos[pNum].items.push(order);
        matrix[area].totalItems++;
    });

    // 5. Evaluate Traffic Light per Pedido and Aggregate to Area
    Object.values(matrix).forEach(areaObj => {
        let areaHasRed = false;
        let areaHasYellow = false;
        let pedidosCount = 0;
        let vencidosCount = 0;

        Object.values(areaObj.pedidos).forEach(group => {
            pedidosCount++;
            let isRed = false;
            let isYellow = false;
            const reasons = [];

            // Condition 1: Days Left (Vencidos o Inminentes)
            if (group.diasRestantes !== null) {
                if (group.diasRestantes < 0) {
                    isRed = true;
                    reasons.push(`Vencido hace ${Math.abs(group.diasRestantes)}d`);
                } else if (group.diasRestantes <= 1) {
                    isRed = true;
                    reasons.push(`Despacho inminente (${group.diasRestantes}d)`);
                }
            }

            // Evaluate items in this pedido
            group.items.forEach(order => {
                if (order.alertas_insumos && order.alertas_insumos.length > 0) {
                    const unresolved = order.alertas_insumos.filter(a => !a.resuelta);
                    if (unresolved.length > 0) {
                        isYellow = true;
                        reasons.push(`Falta de insumos`);
                    }
                }
                
                if (order.bitacoraCalidad && order.bitacoraCalidad.length > 0) {
                    isYellow = true;
                    reasons.push(`Novedad de calidad`);
                }

                let entryTime = null;
                if (order.historial && order.historial.length > 0) {
                    const lastH = order.historial[order.historial.length - 1];
                    if (lastH && lastH.fecha) entryTime = new Date(lastH.fecha).getTime();
                } else if (order.creadoEn) {
                    entryTime = new Date(order.creadoEn).getTime();
                }

                if (entryTime) {
                    const daysStagnant = (Date.now() - entryTime) / (1000 * 60 * 60 * 24);
                    if (daysStagnant > 6) {
                        isRed = true;
                        if (!reasons.includes(`Estancado >6 días`)) reasons.push(`Estancado >6 días`);
                    } else if (daysStagnant >= 3) {
                        isYellow = true;
                        if (!reasons.includes(`Estancado 3-6 días`)) reasons.push(`Estancado 3-6 días`);
                    }
                }
            });

            if (isRed) {
                group.semaforo = 'red';
                vencidosCount++;
                areaHasRed = true;
            } else if (isYellow) {
                group.semaforo = 'yellow';
                areaHasYellow = true;
            } else {
                group.semaforo = 'green';
            }
            
            group.alertReasons = [...new Set(reasons)];
        });

        // Set Area metrics
        areaObj.totalPedidos = pedidosCount;
        areaObj.pedidosVencidos = vencidosCount;
        
        if (areaHasRed) areaObj.semaforoGeneral = 'red';
        else if (areaHasYellow) areaObj.semaforoGeneral = 'yellow';
        else areaObj.semaforoGeneral = 'green';

        // Convert pedidos map to sorted array
        areaObj.pedidos = Object.values(areaObj.pedidos).sort((a, b) => {
            const val = { 'red': 0, 'yellow': 1, 'green': 2 };
            if (val[a.semaforo] !== val[b.semaforo]) return val[a.semaforo] - val[b.semaforo];
            return (a.diasRestantes || 999) - (b.diasRestantes || 999);
        });
    });

    // 6. Sort areas alphabetically
    const sortedAreas = Object.values(matrix).sort((a, b) => a.areaName.localeCompare(b.areaName));
    return sortedAreas;
};
