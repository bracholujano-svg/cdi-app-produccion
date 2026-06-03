import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { parseNumber } from '../utils/helpers';

export const useSupabaseData = () => {
    const [supabaseData, setSupabaseData] = useState(null);

    useEffect(() => {
        const fetchSupabaseData = async () => {
            try {
                const fetchAll = async (table) => {
                    let allData = [];
                    let from = 0;
                    const step = 1000;
                    let hasMore = true;
                    while (hasMore) {
                        const { data, error } = await supabase
                            .from(table)
                            .select('*')
                            .range(from, from + step - 1);
                        if (error || !data || data.length === 0) {
                            hasMore = false;
                        } else {
                            allData = allData.concat(data);
                            from += step;
                            if (data.length < step) hasMore = false;
                        }
                    }
                    return allData;
                };

                const inv = await fetchAll('inventario');
                const req = await fetchAll('requerimientos_pedido');

                const invMap = inv ? inv.map(item => ({
                    id_referencia: item['Id Referencia'],
                    descripcion: item['Referencia'],
                    cantidad_disponible: parseNumber(item['Saldo'])
                })) : [];

                const reqRaw = req ? req.map(item => ({
                    pedido_num: item['pedidosin'],
                    id_referencia: item['Id Referencia'],
                    cantidad_requerida: parseNumber(item['Cantidad']),
                    cantidad_oc: parseNumber(item['Cant.OC']),
                    descripcion: item['Descripcion']
                })) : [];

                // Agrupar requerimientos por pedido y por referencia
                const groupedReqs = {};
                reqRaw.forEach(item => {
                    const key = `${item.pedido_num}_${item.id_referencia}`;
                    if (!groupedReqs[key]) {
                        groupedReqs[key] = { ...item };
                    } else {
                        groupedReqs[key].cantidad_requerida += item.cantidad_requerida;
                        groupedReqs[key].cantidad_oc += item.cantidad_oc;
                    }
                });
                const reqMap = Object.values(groupedReqs);

                if (inv && req) {
                    setSupabaseData({ inventario: invMap, pedidosInsumos: reqMap });
                }
            } catch(e) { console.error("Error fetching Supabase", e); }
        };

        // Iniciar Sesión Híbrida en el Backend antes de descargar datos
        const initBackendSecureSession = async () => {
            const masterEmail = import.meta.env.VITE_MASTER_EMAIL || "rafael.bracho@cdiexhibiciones.co";
            const masterPass = import.meta.env.VITE_MASTER_PASS || "Cdi_Vault_2026**";
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email: masterEmail,
                password: masterPass,
            });

            if (error) {
                console.warn("Info de Seguridad: Operando con llave anónima. Una vez actives RLS, los datos requerirán la cuenta maestra.");
            }
            fetchSupabaseData();
        };

        initBackendSecureSession();
        
        // Optional: Realtime subscription for Supabase
        try {
            const channels = supabase.channel('custom-all-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, fetchSupabaseData)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos_pedido' }, fetchSupabaseData)
                .subscribe();
            return () => { supabase.removeChannel(channels); };
        } catch(e) {}
    }, []);

    return { supabaseData, setSupabaseData };
};
