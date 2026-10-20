import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { deepSanitize } from '../utils/security';

/**
 * Detecta si un registro en `produccion_pedidos` fue volcado automáticamente
 * desde el Excel de Ribisoft sin haber sido ingresado explícitamente a planta
 * por un usuario ni tener movimientos en planta.
 */
export const isUnassignedErpBulkImport = (orderObj) => {
    if (!orderObj || typeof orderObj !== 'object') return false;
    const hist = Array.isArray(orderObj.historial) ? orderObj.historial : [];
    const firstHist = hist[0] || {};
    const isFromErpImporter =
        firstHist.entrega === 'ERP RIBISOFT' ||
        firstHist.accion === 'Importación ERP Ribisoft (Ingreso Inicial)';

    if (!isFromErpImporter) return false;

    const hasPlantMoves =
        hist.length > 1 ||
        (Array.isArray(orderObj.bitacoraTurnos) && orderObj.bitacoraTurnos.length > 0) ||
        (Array.isArray(orderObj.bitacoraCalidad) && orderObj.bitacoraCalidad.length > 0) ||
        (orderObj.areaActual && orderObj.areaActual !== 'Diseño') ||
        orderObj.estadoInterno === 'DESPACHADO' ||
        Boolean(orderObj.isTerminado);

    return !hasPlantMoves;
};

export const useOrders = () => {
    const [orders, setOrders] = useState([]);
    const [coordinationAlerts, setCoordinationAlerts] = useState([]);

    const syncOrderToSupabase = async (orderObject, isDelete = false) => {
        if (!orderObject || !orderObject.id) return;
        
        let retries = 2;
        while (retries >= 0) {
            try {
                let dbError = null;
                if (isDelete) {
                    const { error } = await supabase.from('produccion_pedidos').delete().eq('id', orderObject.id);
                    dbError = error;
                } else {
                    const sanitizedOrder = deepSanitize(orderObject);
                    const upsertPayload = {
                        id: sanitizedOrder.id,
                        pedido_num: sanitizedOrder.pedidoNum || '',
                        cliente: sanitizedOrder.cliente || '',
                        codigo_item: sanitizedOrder.codArticulo || sanitizedOrder.codigo_item || null,
                        areas_compartidas: sanitizedOrder.areas_compartidas || [],
                        asignado_a: Array.isArray(sanitizedOrder.asignado_a) ? sanitizedOrder.asignado_a : (sanitizedOrder.asignado_a ? [sanitizedOrder.asignado_a] : []),
                        data_completa: sanitizedOrder
                    };
                    const optionalErpCols = ['dim_1', 'dim_2', 'dim_3', 'acabado_1', 'acabado_2', 'acabado_3', 'caracteristicas', 'programador', 'nombre_proyecto', 'categoria', 'notas', 'observaciones_erp', 'fecha_asigna', 'fecha_genera_ped'];
                    optionalErpCols.forEach(col => {
                        if (sanitizedOrder[col] !== undefined) upsertPayload[col] = sanitizedOrder[col];
                    });
                    const { error } = await supabase.from('produccion_pedidos').upsert(upsertPayload);
                    dbError = error;
                }
                
                if (dbError) {
                    if (dbError.message?.includes('Failed to fetch') && retries > 0) {
                        retries--;
                        await new Promise(res => setTimeout(res, 1000)); // wait 1s before retry
                        continue;
                    }
                    console.error("DB Error al sincronizar orden:", dbError);
                    alert(`❌ Error al guardar en base de datos: ${dbError.message || JSON.stringify(dbError)}. Verifica la seguridad RLS o tu conexión a internet.`);
                }
                break; // success or non-retryable error
            } catch (e) { 
                if (e.message?.includes('Failed to fetch') && retries > 0) {
                    retries--;
                    await new Promise(res => setTimeout(res, 1000));
                    continue;
                }
                console.error("Error al sincronizar orden", e); 
                alert(`❌ Error inesperado de red: ${e.message || JSON.stringify(e)}. Verifica tu conexión.`);
                break;
            }
        }
    };

    const syncAlertToSupabase = async (alertObject, isDelete = false) => {
        if (!alertObject || !alertObject.id) return;
        try {
            let dbError = null;
            if (isDelete) {
                const { error } = await supabase.from('coordinacion_alertas').delete().eq('id', alertObject.id);
                dbError = error;
            } else {
                const sanitizedAlert = deepSanitize(alertObject);
                const { error } = await supabase.from('coordinacion_alertas').upsert({
                    id: sanitizedAlert.id,
                    data_completa: sanitizedAlert
                });
                dbError = error;
            }
            if (dbError) {
                console.error("DB Error al sincronizar alerta:", dbError);
                alert(`❌ Error al guardar alerta en base de datos: ${dbError.message || JSON.stringify(dbError)}. Verifica la seguridad RLS en Supabase.`);
            }
        } catch (e) { console.error("Error al sincronizar alerta", e); }
    };

    useEffect(() => {
        const fetchProduccion = async () => {
            try {
                // Ensure the session is loaded from local storage before querying to prevent RLS from blocking the request
                await supabase.auth.getSession();
                
                let allPedidosRows = [];
                let from = 0;
                const step = 1000;
                let hasMore = true;

                while (hasMore) {
                    const { data: batchData, error: e1 } = await supabase
                        .from('produccion_pedidos')
                        .select('id, codigo_item, data_completa')
                        .range(from, from + step - 1);

                    if (e1) {
                        console.error('RLS Error Pedidos:', e1);
                        hasMore = false;
                    } else if (!batchData || batchData.length === 0) {
                        hasMore = false;
                    } else {
                        allPedidosRows = allPedidosRows.concat(batchData);
                        from += step;
                        if (batchData.length < step) hasMore = false;
                    }
                }

                if (allPedidosRows.length > 0) {
                    const validPlantOrders = [];
                    const autoImportedIdsToPurge = [];

                    for (const row of allPedidosRows) {
                        if (!row?.data_completa || typeof row.data_completa !== 'object') continue;
                        const d = { ...row.data_completa };
                        if (row.codigo_item && !d.codArticulo) {
                            d.codArticulo = row.codigo_item;
                            d.codigo_item = row.codigo_item;
                        }
                        if (!d.id || !d.pedidoNum) continue;

                        // Excluir y purgar los registros que se habían volcado automáticamente desde el Excel
                        // sin haber sido ingresados manualmente ni por búsqueda a planta
                        if (isUnassignedErpBulkImport(d)) {
                            autoImportedIdsToPurge.push(row.id || d.id);
                            continue;
                        }

                        validPlantOrders.push(d);
                    }

                    setOrders(validPlantOrders);

                    // Limpiar en segundo plano de `produccion_pedidos` las filas que no fueron ingresadas a planta
                    if (autoImportedIdsToPurge.length > 0) {
                        (async () => {
                            for (let i = 0; i < autoImportedIdsToPurge.length; i += 200) {
                                const chunk = autoImportedIdsToPurge.slice(i, i + 200);
                                await supabase.from('produccion_pedidos').delete().in('id', chunk);
                            }
                        })();
                    }
                } else {
                    setOrders([]);
                }
                
                const { data: alertasData } = await supabase.from('coordinacion_alertas').select('data_completa');
                if (alertasData) {
                    setCoordinationAlerts(alertasData
                        .map(row => row.data_completa)
                        .filter(a => a && typeof a === 'object' && a.id && a.pedidoNum)
                    );
                }
            } catch (err) { console.error('Error fetching produccion:', err); alert('Error de permisos (RLS): ' + (err?.message || err)); }
        };
        fetchProduccion();
        
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                fetchProduccion();
            }
        });

        const handleErpSyncEvent = () => {
            fetchProduccion();
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('cdi-erp-synced', handleErpSyncEvent);
        }

        const handleProduccionPayload = (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const newData = payload.new?.data_completa;
                if (!newData || !newData.id || isUnassignedErpBulkImport(newData)) return;
                
                setOrders(prev => {
                    const idx = prev.findIndex(o => o.id === newData.id);
                    if (idx >= 0) {
                        const newArr = [...prev];
                        newArr[idx] = newData;
                        return newArr;
                    } else {
                        return [...prev, newData];
                    }
                });
            } else if (payload.eventType === 'DELETE') {
                const oldId = payload.old?.id;
                if (oldId) {
                    setOrders(prev => prev.filter(o => o.id !== oldId));
                }
            }
        };

        const handleAlertasPayload = (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const newData = payload.new?.data_completa;
                if (!newData || !newData.id) return;
                
                setCoordinationAlerts(prev => {
                    const idx = prev.findIndex(a => a.id === newData.id);
                    if (idx >= 0) {
                        const newArr = [...prev];
                        newArr[idx] = newData;
                        return newArr;
                    } else {
                        return [...prev, newData];
                    }
                });
            } else if (payload.eventType === 'DELETE') {
                const oldId = payload.old?.id;
                if (oldId) {
                    setCoordinationAlerts(prev => prev.filter(a => a.id !== oldId));
                }
            }
        };

        const subPedidos = supabase.channel('pedidos-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'produccion_pedidos' }, handleProduccionPayload).subscribe();
            
        const subAlertas = supabase.channel('alertas-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinacion_alertas' }, handleAlertasPayload).subscribe();

        return () => {
            supabase.removeChannel(subPedidos);
            supabase.removeChannel(subAlertas);
            authListener?.subscription?.unsubscribe();
            if (typeof window !== 'undefined') {
                window.removeEventListener('cdi-erp-synced', handleErpSyncEvent);
            }
        };
    }, []);

    return {
        orders,
        setOrders,
        coordinationAlerts,
        setCoordinationAlerts,
        syncOrderToSupabase,
        syncAlertToSupabase
    };
};
