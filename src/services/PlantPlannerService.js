import { getDaysLeft } from '../utils/helpers';
import { AREAS_PLANTA } from '../utils/constants';

// Áreas oficiales fijas de planta (desacoplando "PROGRAMACIÓN Y DISEÑO" en tarjetas independientes)
export const OFFICIAL_PLANNER_AREAS = [
    "Diseño",
    "Programación CNC",
    ...AREAS_PLANTA.filter(a => a !== 'Despachos')
];

/**
 * Normaliza y desacopla cualquier área heredada como "PROGRAMACIÓN Y DISEÑO"
 * garantizando que solo existan tarjetas oficiales e independientes.
 */
export const normalizePlannerArea = (rawArea) => {
    if (!rawArea) return 'Por Asignar';
    const clean = String(rawArea).trim();
    const upper = clean.toUpperCase();

    // Desacoplar "PROGRAMACIÓN Y DISEÑO" unificado
    if (upper.includes('PROGRAMACIÓN Y DISEÑO') || upper.includes('PROGRAMACION Y DISENO') ||
        upper.includes('DISEÑO Y PROGRAMACIÓN') || upper.includes('DISENO Y PROGRAMACION')) {
        return 'Diseño';
    }
    if (upper === 'DISEÑO' || upper === 'DISENO') {
        return 'Diseño';
    }
    if (upper === 'PROGRAMACIÓN CNC' || upper === 'PROGRAMACION CNC' || 
        upper === 'PROGRAMACIÓN' || upper === 'PROGRAMACION') {
        return 'Programación CNC';
    }

    const match = OFFICIAL_PLANNER_AREAS.find(a => a.toUpperCase() === upper);
    if (match) return match;

    return clean;
};

export const calculatePlantMatrix = (orders, inventoryReservations = null) => {
    // 1. Filtrado estricto en tiempo real: excluir pedidos inactivos, despachados, finalizados y en tránsito
    const INACTIVE_STATUSES = [
        'DESPACHADO',
        'FINALIZADO',
        'INACTIVO',
        'TERMINADO',
        'COMPLETADO',
        'ENTREGADO',
        'CANCELADO',
        'ANULADO'
    ];

    const activeOrders = (orders || []).filter(o => {
        if (!o || !o.id) return false;

        const estadoInt = String(o.estadoInterno || '').trim().toUpperCase();
        const estado = String(o.estado || '').trim().toUpperCase();
        const areaActual = String(o.areaActual || '').trim().toUpperCase();

        // Excluir explícitamente cualquier ítem con estado inactivo o finalizado
        if (INACTIVE_STATUSES.includes(estadoInt) || INACTIVE_STATUSES.includes(estado)) {
            return false;
        }

        if (estadoInt.includes('FINALIZAD') || estadoInt.includes('INACTIV') || 
            estadoInt.includes('DESPACHAD') || estadoInt.includes('ENTREGAD') ||
            estadoInt.includes('CANCELAD') || estadoInt.includes('ANULAD')) {
            return false;
        }

        // Excluir si su área actual es Despachos o está marcado como terminado/finalizado
        if (areaActual === 'DESPACHOS' || o.isTerminado === true || o.isFinalizado === true) {
            return false;
        }

        // Excluir clones de bifurcaciones ya convergidas en áreas finales
        if (o.master_id && ['ENSAMBLE', 'EMPAQUE', 'DESPACHOS'].includes(areaActual)) {
            return false;
        }

        // Excluir si ya fue despachado/movido en tránsito fuera de esta área
        if (o.transferenciaPendiente && o.transferenciaPendiente.haciaArea && o.transferenciaPendiente.haciaArea !== o.areaActual) {
            return false;
        }
        if (estadoInt.includes('TRÁNSITO') || estadoInt.includes('TRANSITO')) {
            return false;
        }

        return true;
    });
    
    // 2. Inicializar matriz con las áreas oficiales fijas (garantizando tarjetas separadas: DISEÑO y PROGRAMACIÓN CNC)
    const matrix = {};
    OFFICIAL_PLANNER_AREAS.forEach(area => {
        matrix[area] = {
            areaName: area,
            totalItems: 0,
            totalPedidos: 0,
            pedidosVencidos: 0,
            upcomingItemsCount: 0,
            upcomingPedidosCount: 0,
            semaforoGeneral: 'green',
            pedidos: {},
            upcomingPedidos: {}
        };
    });

    // 3. Poblar la matriz agrupando por área real normalizada
    activeOrders.forEach(order => {
        const area = normalizePlannerArea(order.areaActual);
        
        // Si hay un área no estándar fuera de las oficiales pero válida y activa, inicializarla
        if (!matrix[area]) {
            matrix[area] = {
                areaName: area,
                totalItems: 0,
                totalPedidos: 0,
                pedidosVencidos: 0,
                upcomingItemsCount: 0,
                upcomingPedidosCount: 0,
                semaforoGeneral: 'green',
                pedidos: {},
                upcomingPedidos: {}
            };
        }
        
        const pNum = order.pedidoNum || 'SIN_PEDIDO';
        
        if (!matrix[area].pedidos[pNum]) {
            matrix[area].pedidos[pNum] = {
                pedidoNum: pNum,
                cliente: order.cliente || 'Desconocido',
                fechaEntregaPrometida: order.fechaEntregaPrometida,
                diasRestantes: getDaysLeft(order.fechaEntregaPrometida),
                items: [],
                semaforo: 'green',
                alertReasons: [],
                orderMatSummary: null
            };
        }
        
        matrix[area].pedidos[pNum].items.push(order);
        matrix[area].totalItems++;
    });

    // 4. MOTOR ANTI-ERROR HUMANO: Detectar productos que VIENEN EN CAMINO / PROGRAMADOS A PASAR por cada área
    // según sus materiales requeridos en almacén (RQ) y sus acabados ERP
    if (inventoryReservations && typeof inventoryReservations.getProductRouting === 'function') {
        const FINAL_STAGE_AREAS = ['ENSAMBLE', 'EMPAQUE', 'DESPACHOS'];
        const evaluatedUpcomingKeysPerArea = {};

        activeOrders.forEach(order => {
            const pNum = String(order.pedidoNum || 'SIN_PEDIDO');
            const codArt = String(order.codArticulo || order.codigo_item || '').trim();
            const prodName = String(order.nombre || order.descripcion || '').trim();
            const currentArea = normalizePlannerArea(order.areaActual);
            const currentAreaUpper = currentArea.toUpperCase();

            const routing = inventoryReservations.getProductRouting(pNum, codArt, order);
            if (!routing || !Array.isArray(routing.requiredAreas) || routing.requiredAreas.length === 0) return;

            // Buscar toda la familia de este producto en el pedido (original + clones bifurcados)
            const family = activeOrders.filter(o =>
                String(o.pedidoNum || '') === pNum &&
                String(o.codArticulo || o.codigo_item || '').trim() === codArt &&
                String(o.nombre || o.descripcion || '').trim() === prodName
            );

            routing.requiredAreas.forEach(targetArea => {
                if (!matrix[targetArea]) return;
                if (targetArea === currentArea) return;

                // Si el área objetivo no es Ensamble y el producto ya está en Ensamble/Empaque/Despachos, ya superó las fases previas
                if (targetArea !== 'Ensamble' && FINAL_STAGE_AREAS.includes(currentAreaUpper)) {
                    return;
                }

                // Verificar si algún miembro de la familia ya está físicamente en targetArea o ya pasó por targetArea en su historial
                const alreadyInOrPassedTarget = family.some(f => {
                    if (normalizePlannerArea(f.areaActual) === targetArea) return true;
                    if (f.transferenciaPendiente?.haciaArea === targetArea) return true;
                    return (f.historial || []).some(h =>
                        (h.accion && h.accion.toUpperCase().includes(targetArea.toUpperCase())) ||
                        (h.entrega && h.entrega.toUpperCase() === targetArea.toUpperCase())
                    );
                });

                if (alreadyInOrPassedTarget) return;

                if (!evaluatedUpcomingKeysPerArea[targetArea]) {
                    evaluatedUpcomingKeysPerArea[targetArea] = new Set();
                }
                const uniqueProdKey = `${pNum}__${codArt}__${prodName}`;
                if (evaluatedUpcomingKeysPerArea[targetArea].has(uniqueProdKey)) return;
                evaluatedUpcomingKeysPerArea[targetArea].add(uniqueProdKey);

                if (!matrix[targetArea].upcomingPedidos[pNum]) {
                    matrix[targetArea].upcomingPedidos[pNum] = {
                        pedidoNum: pNum,
                        cliente: order.cliente || 'Desconocido',
                        fechaEntregaPrometida: order.fechaEntregaPrometida,
                        diasRestantes: getDaysLeft(order.fechaEntregaPrometida),
                        items: []
                    };
                }

                matrix[targetArea].upcomingPedidos[pNum].items.push({
                    ...order,
                    routingReasons: routing.reasonsByArea?.[targetArea] || ['Ruta técnica detectada']
                });
                matrix[targetArea].upcomingItemsCount++;
            });
        });
    }

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

            // Condition 2: Evaluación ERP de Materias Primas por Producto (codpt) y Resumen en Pedido
            if (inventoryReservations && typeof inventoryReservations.getOrderSummary === 'function') {
                const matSummary = inventoryReservations.getOrderSummary(group.pedidoNum, group.items);
                group.orderMatSummary = matSummary;
                if (matSummary.status === 'SIN_STOCK') {
                    isRed = true;
                    reasons.push(matSummary.label);
                } else if (matSummary.status === 'PENDIENTE_ENTREGA') {
                    isYellow = true;
                    reasons.push(matSummary.label);
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

        const upcomingArr = Object.values(areaObj.upcomingPedidos || {}).sort((a, b) => {
            return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
        });
        areaObj.upcomingPedidos = upcomingArr;
        areaObj.upcomingPedidosCount = upcomingArr.length;
    });

    // 6. Ordenar áreas según el flujo oficial de planta (Diseño y Programación CNC de primeros)
    const areaOrderMap = {};
    OFFICIAL_PLANNER_AREAS.forEach((name, idx) => {
        areaOrderMap[name] = idx;
    });

    const sortedAreas = Object.values(matrix).sort((a, b) => {
        const orderA = areaOrderMap[a.areaName] !== undefined ? areaOrderMap[a.areaName] : 999;
        const orderB = areaOrderMap[b.areaName] !== undefined ? areaOrderMap[b.areaName] : 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.areaName.localeCompare(b.areaName);
    });
    return sortedAreas;
};
