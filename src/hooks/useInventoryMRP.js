import { useMemo } from 'react';

export const useInventoryMRP = (orders, supabaseData) => {
    return useMemo(() => {
        const virtualStock = {};
        if (supabaseData?.inventario) {
            supabaseData.inventario.forEach(inv => {
                virtualStock[inv.id_referencia] = inv.cantidad_disponible || 0;
            });
        }

        const activeOrders = orders.filter(o => o.estadoInterno !== 'DESPACHADO');
        
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
            const pNum = o.pedidoNum;
            orderMaterialStatus[pNum] = [];
            const reqs = supabaseData?.pedidosInsumos?.filter(r => String(r.pedido_num).trim().toUpperCase() === String(pNum).trim().toUpperCase()) || [];
            
            reqs.forEach(req => {
                const id_ref = req.id_referencia;
                const cantidadRequerida = req.cantidad_requerida - (req.cantidad_oc || 0);
                
                if (cantidadRequerida <= 0) {
                    orderMaterialStatus[pNum].push({
                        ...req,
                        id_referencia: id_ref,
                        descripcion: supabaseData.inventario.find(i => i.id_referencia === id_ref)?.descripcion || req.descripcion || id_ref,
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
                    virtualStock[id_ref] -= cantidadRequerida;
                } else {
                    asignado = available;
                    faltante = cantidadRequerida - available;
                    virtualStock[id_ref] = 0;
                }
                
                orderMaterialStatus[pNum].push({
                    ...req,
                    id_referencia: id_ref,
                    descripcion: supabaseData.inventario.find(i => i.id_referencia === id_ref)?.descripcion || req.descripcion || id_ref,
                    requerida: cantidadRequerida,
                    asignada: asignado,
                    faltante: faltante,
                    stockRestanteGlobal: virtualStock[id_ref],
                    sinOC: (req.cantidad_oc || 0) === 0
                });
            });
        });
        return orderMaterialStatus;
    }, [orders, supabaseData]);
};
