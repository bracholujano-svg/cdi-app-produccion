import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import localforage from 'localforage';

export const useSupabaseData = () => {
    const [supabaseData, setSupabaseData] = useState(null);
    const workerRef = useRef(null);

    useEffect(() => {
        // Inicializar Worker
        workerRef.current = new Worker(new URL('../workers/mrpWorker.js', import.meta.url), { type: 'module' });
        
        workerRef.current.onmessage = (e) => {
            if (e.data.status === 'success') {
                setSupabaseData(e.data.data);
                // Guardar el resultado final procesado en el caché para carga instantánea futura
                localforage.setItem('cdi_mrp_processed_cache', e.data.data);
            } else {
                console.error("Worker error:", e.data.error);
            }
        };

        const loadFromCacheAndFetch = async () => {
            try {
                // 1. Mostrar caché primero para que la interfaz cargue rápido
                const cachedData = await localforage.getItem('cdi_mrp_processed_cache');
                if (cachedData) {
                    setSupabaseData(cachedData);
                }

                // 2. Fetch de BD en segundo plano
                const fetchAll = async (table) => {
                    let allData = [];
                    let from = 0;
                    const step = 1000;
                    let hasMore = true;
                    while (hasMore) {
                        const { data, error } = await supabase
                            .from(table)
                            .select('*')
                            // Ordenado por ID si existe, o limitará paginación
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

                // Enviar data cruda al Worker para procesarla en segundo plano
                if (inv && req) {
                    workerRef.current.postMessage({
                        action: 'PROCESS_DATA',
                        payload: { inv, req }
                    });
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
            loadFromCacheAndFetch();
        };

        initBackendSecureSession();
        
        // Manejar Realtime de manera incremental (no refetch total)
        const handleRealtimeInventario = async (payload) => {
            // Un refetch total en realtime puede bloquear, idealmente sería incremental.
            // Por ahora, para mantener la lógica exacta, programamos una recarga asincrónica (debounce-like)
            // Esto se optimizará en la siguiente versión para inyectar directamente el payload.
            loadFromCacheAndFetch(); 
        };

        let debounceTimeout;
        const handleRealtimeRequerimientos = async (payload) => {
             clearTimeout(debounceTimeout);
             debounceTimeout = setTimeout(() => {
                 loadFromCacheAndFetch();
             }, 2000);
        };

        try {
            const channels = supabase.channel('custom-all-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, handleRealtimeInventario)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos_pedido' }, handleRealtimeRequerimientos)
                .subscribe();
            
            return () => { 
                supabase.removeChannel(channels); 
                if (workerRef.current) workerRef.current.terminate();
            };
        } catch(e) {}
    }, []);

    return { supabaseData, setSupabaseData };
};
