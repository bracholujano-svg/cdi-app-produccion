import { useMemo } from 'react';

export const useInventoryMRP = (orders, supabaseData) => {
    return useMemo(() => {
        const virtualStock = {};
        const inventoryDescMap = {}; // O(1) description lookup
        
        if (supabaseData?.inventario) {
            supabaseData.inventario.forEach(inv => {
                const normId = String(inv.id_referencia || '').trim().toUpperCase();
                if(normId) {
                    virtualStock[normId] = (virtualStock[normId] || 0) + (inv.cantidad_disponible || 0);
                    inventoryDescMap[normId] = inv.descripcion;
                }
            });
        }

        // Pre-agrupar requerimientos por pedido en un HashMap O(M)
        const reqsByPedido = {};
        if (supabaseData?.pedidosInsumos) {
            supabaseData.pedidosInsumos.forEach(r => {
                const pNum = String(r.pedido_num || '').trim().toUpperCase();
                if (!reqsByPedido[pNum]) reqsByPedido[pNum] = [];
                reqsByPedido[pNum].push(r);
            });
        }

        const activeOrders = orders.filter(o => o.estadoInterno !== 'DESPACHADO');
        
        // El ordenamiento afecta en qué orden los pedidos agarran virtual stock
        activeOrders.sort((a, b) => {
            if (a.prioridad === 'ALTA' && b.prioridad !== 'ALTA') return -1;
            if (b.prioridad === 'ALTA' && a.prioridad !== 'ALTA') return 1;
            const dateA = a.fechaEntregaPrometida ? new Date(a.fechaEntregaPrometida).getTime() : Infinity;
            const dateB = b.fechaEntregaPrometida ? new Date(b.fechaEntregaPrometida).getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;
            return String(a.pedidoNum || "").localeCompare(String(b.pedidoNum || ""));
        });

        const orderMaterialStatus = {};
        
        activeOrders.forEach(o => {
            const pNum = String(o.pedidoNum || '');
            const pNumNorm = pNum.trim().toUpperCase();
            orderMaterialStatus[pNum] = [];
            
            // O(1) lookup en lugar de .filter
            const reqs = reqsByPedido[pNumNorm] || [];
            
            reqs.forEach(req => {
                const id_ref = String(req.id_referencia || '').trim().toUpperCase();
                const originalId = req.id_referencia;
                const cantidadRequerida = req.cantidad_requerida - (req.cantidad_oc || 0);
                
                // O(1) lookup en lugar de .find
                const desc = inventoryDescMap[id_ref] || req.descripcion || originalId;

                if (cantidadRequerida <= 0) {
                    orderMaterialStatus[pNum].push({
                        ...req,
                        id_referencia: originalId,
                        descripcion: desc,
                        requerida: req.cantidad_requerida,
                        asignada: req.cantidad_requerida,
                        faltante: 0,
                        stockRestanteGlobal: virtualStock[id_ref] || 0,
                        sinOC: false
                    });
                    return;
                }
                
                let available = virtualStock[id_ref] || 0;
                let asignado = 0;
                let faltante = 0;
                
                if (available >= cantidadRequerida) {
                    asignado = cantidadRequerida;
                } else {
                    asignado = available;
                    faltante = cantidadRequerida - available;
                }
                
                orderMaterialStatus[pNum].push({
                    ...req,
                    id_referencia: originalId,
                    descripcion: desc,
                    requerida: cantidadRequerida,
                    asignada: asignado,
                    faltante: faltante,
                    stockRestanteGlobal: virtualStock[id_ref] || 0,
                    sinOC: (req.cantidad_oc || 0) === 0
                });
            });
        });
        return orderMaterialStatus;
    }, [orders, supabaseData]);
};
