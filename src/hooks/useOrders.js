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
                const { data: pedidosData } = await supabase.from('produccion_pedidos').select('data_completa');
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
            } catch (err) {}
        };
        fetchProduccion();

        const subPedidos = supabase.channel('pedidos-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'produccion_pedidos' }, fetchProduccion).subscribe();
            
        const subAlertas = supabase.channel('alertas-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinacion_alertas' }, fetchProduccion).subscribe();

        return () => {
            supabase.removeChannel(subPedidos);
            supabase.removeChannel(subAlertas);
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
