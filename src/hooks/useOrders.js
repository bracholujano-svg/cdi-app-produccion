import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { deepSanitize } from '../utils/security';

export const useOrders = () => {
    const [orders, setOrders] = useState([]);
    const [coordinationAlerts, setCoordinationAlerts] = useState([]);

    const syncOrderToSupabase = async (orderObject, isDelete = false) => {
        if (!orderObject || !orderObject.id) return;
        try {
            let dbError = null;
            if (isDelete) {
                const { error } = await supabase.from('produccion_pedidos').delete().eq('id', orderObject.id);
                dbError = error;
            } else {
                const sanitizedOrder = deepSanitize(orderObject);
                const { error } = await supabase.from('produccion_pedidos').upsert({
                    id: sanitizedOrder.id,
                    pedido_num: sanitizedOrder.pedidoNum || '',
                    cliente: sanitizedOrder.cliente || '',
                    areas_compartidas: sanitizedOrder.areas_compartidas || [],
                    asignado_a: Array.isArray(sanitizedOrder.asignado_a) ? sanitizedOrder.asignado_a : (sanitizedOrder.asignado_a ? [sanitizedOrder.asignado_a] : []),
                    data_completa: sanitizedOrder
                });
                dbError = error;
            }
            if (dbError) {
                console.error("DB Error al sincronizar orden:", dbError);
                alert(`❌ Error al guardar en base de datos: ${dbError.message || JSON.stringify(dbError)}. Verifica la seguridad RLS en Supabase.`);
            }
        } catch (e) { console.error("Error al sincronizar orden", e); }
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
                
                const { data: pedidosData, error: e1 } = await supabase.from('produccion_pedidos').select('data_completa');
                if(e1) console.error('RLS Error Pedidos:', e1);
                if (pedidosData) {
                    setOrders(pedidosData
                        .map(row => row.data_completa)
                        .filter(o => o && typeof o === 'object' && o.id && o.pedidoNum)
                    );
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

        const handleProduccionPayload = (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const newData = payload.new?.data_completa;
                if (!newData || !newData.id) return;
                
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
