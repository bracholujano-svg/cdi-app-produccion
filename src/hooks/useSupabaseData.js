import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import localforage from 'localforage';

export const useSupabaseData = () => {
    const [supabaseData, setSupabaseData] = useState(null);
    const workerRef = useRef(null);
    const isFetchingRef = useRef(false);
    const lastFullFetchAtRef = useRef(0);
    const rawInvRef = useRef(null);
    const rawReqRef = useRef(null);

    useEffect(() => {
        // Inicializar Worker
        workerRef.current = new Worker(new URL('../workers/mrpWorker.js', import.meta.url), { type: 'module' });
        
        workerRef.current.onmessage = (e) => {
            if (e.data.status === 'success') {
                setSupabaseData(e.data.data);
                // Guardar el resultado final procesado en el caché para carga instantánea futura
                localforage.setItem('cdi_mrp_processed_cache_v3', e.data.data);
            } else {
                console.error("Worker error:", e.data.error);
            }
        };

        const dispatchToWorker = (invData, reqData) => {
            if (workerRef.current && invData && reqData) {
                workerRef.current.postMessage({
                    action: 'PROCESS_DATA',
                    payload: { inv: invData, req: reqData }
                });
            }
        };

        const MRP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de vigencia para caché local MRP

        const loadFromCacheAndFetch = async (force = false) => {
            const now = Date.now();
            if (isFetchingRef.current) return;
            if (!force && lastFullFetchAtRef.current > 0 && now - lastFullFetchAtRef.current < MRP_CACHE_TTL_MS) {
                return;
            }
            isFetchingRef.current = true;

            try {
                // Ensure the user session is loaded to pass RLS
                await supabase.auth.getSession();
                
                // 1. Mostrar caché primero para carga instantánea y evitar re-descargas en F5 repetidos
                if (!rawInvRef.current) {
                    const [cachedData, cachedTs] = await Promise.all([
                        localforage.getItem('cdi_mrp_processed_cache_v3'),
                        localforage.getItem('cdi_mrp_processed_cache_ts_v3')
                    ]);
                    if (cachedData) {
                        setSupabaseData(cachedData);
                        if (!force && cachedTs && now - Number(cachedTs) < MRP_CACHE_TTL_MS) {
                            lastFullFetchAtRef.current = Number(cachedTs);
                            return;
                        }
                    }
                }

                // 2. Fetch de BD en segundo plano en paralelo (con tope de seguridad)
                const fetchAll = async (table, maxRows = 10000) => {
                    let allData = [];
                    let from = 0;
                    const step = 1000;
                    let hasMore = true;
                    while (hasMore && allData.length < maxRows) {
                        let query = supabase
                            .from(table)
                            .select('*');
                        if (table === 'requerimientos_pedido') {
                            query = query
                                .not('pedido_sin', 'is', null)
                                .not('idreferencia', 'is', null);
                        }
                        const { data, error } = await query
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

                const [inv, req] = await Promise.all([
                    fetchAll('inventario', 6000),
                    fetchAll('requerimientos_pedido', 10000)
                ]);

                if (inv && req) {
                    rawInvRef.current = inv;
                    rawReqRef.current = req;
                    const ts = Date.now();
                    lastFullFetchAtRef.current = ts;
                    localforage.setItem('cdi_mrp_processed_cache_ts_v3', ts).catch(() => {});
                    dispatchToWorker(inv, req);
                }
            } catch(e) {
                console.error("Error fetching Supabase", e);
            } finally {
                isFetchingRef.current = false;
            }
        };

        // Al montar: respeta caché fresca (< 5 min) para no re-descargar miles de filas en cada F5
        loadFromCacheAndFetch(false);
        
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                loadFromCacheAndFetch(false);
            }
        });

        const handleErpSyncEvent = () => {
            loadFromCacheAndFetch(true);
        };
        const handleVisibilityOrFocus = () => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') {
                loadFromCacheAndFetch(false);
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('cdi-erp-synced', handleErpSyncEvent);
            window.addEventListener('cdi-force-sync', handleErpSyncEvent);
            document.addEventListener('visibilitychange', handleVisibilityOrFocus);
        }
        
        let workerDebounceTimeout;
        const scheduleWorkerReprocess = () => {
            clearTimeout(workerDebounceTimeout);
            workerDebounceTimeout = setTimeout(() => {
                if (rawInvRef.current && rawReqRef.current) {
                    dispatchToWorker(rawInvRef.current, rawReqRef.current);
                } else {
                    loadFromCacheAndFetch(false);
                }
            }, 900);
        };

        // Manejar Realtime de manera incremental en memoria (0 consultas de red por evento)
        const handleRealtimeInventario = (payload) => {
            if (!rawInvRef.current || !payload) {
                scheduleWorkerReprocess();
                return;
            }
            const getKey = (r) => r?.id ?? r?.idreferencia ?? r?.id_referencia ?? r?.['Id Referencia'];
            if (payload.eventType === 'INSERT' && payload.new) {
                rawInvRef.current = [...rawInvRef.current, payload.new];
            } else if (payload.eventType === 'UPDATE' && payload.new) {
                const kNew = getKey(payload.new);
                rawInvRef.current = rawInvRef.current.map((item) =>
                    getKey(item) === kNew ? { ...item, ...payload.new } : item
                );
            } else if (payload.eventType === 'DELETE' && payload.old) {
                const kOld = getKey(payload.old);
                rawInvRef.current = rawInvRef.current.filter((item) => getKey(item) !== kOld);
            }
            scheduleWorkerReprocess();
        };

        const handleRealtimeRequerimientos = (payload) => {
            if (!rawReqRef.current || !payload) {
                scheduleWorkerReprocess();
                return;
            }
            const getKey = (r) =>
                r?.id ?? `${r?.numero_rq || ''}_${r?.pedido_sin || ''}_${r?.idreferencia || ''}`;
            if (payload.eventType === 'INSERT' && payload.new) {
                rawReqRef.current = [...rawReqRef.current, payload.new];
            } else if (payload.eventType === 'UPDATE' && payload.new) {
                const kNew = getKey(payload.new);
                rawReqRef.current = rawReqRef.current.map((item) =>
                    getKey(item) === kNew ? { ...item, ...payload.new } : item
                );
            } else if (payload.eventType === 'DELETE' && payload.old) {
                const kOld = getKey(payload.old);
                rawReqRef.current = rawReqRef.current.filter((item) => getKey(item) !== kOld);
            }
            scheduleWorkerReprocess();
        };

        let ribiRealtimeTimeout;
        const handleRealtimeRibisoft = () => {
            clearTimeout(ribiRealtimeTimeout);
            ribiRealtimeTimeout = setTimeout(() => {
                if (typeof window !== 'undefined') {
                    // Emitir evento específico para vistas de Ribisoft sin forzar re-descarga de inventario/producción
                    window.dispatchEvent(new CustomEvent('cdi-ribisoft-updated'));
                }
            }, 4000);
        };

        try {
            const channels = supabase.channel('custom-all-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, handleRealtimeInventario)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos_pedido' }, handleRealtimeRequerimientos)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'ribisoft_pedidos' }, handleRealtimeRibisoft)
                .subscribe();
            
            return () => { 
                clearTimeout(ribiRealtimeTimeout);
                supabase.removeChannel(channels); 
                if (workerRef.current) workerRef.current.terminate();
                authListener?.subscription?.unsubscribe();
                if (typeof window !== 'undefined') {
                    window.removeEventListener('cdi-erp-synced', handleErpSyncEvent);
                    window.removeEventListener('cdi-force-sync', handleErpSyncEvent);
                    document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
                }
            };
        } catch(e) {
            return () => {
                clearTimeout(ribiRealtimeTimeout);
                if (workerRef.current) workerRef.current.terminate();
                authListener?.subscription?.unsubscribe();
                if (typeof window !== 'undefined') {
                    window.removeEventListener('cdi-erp-synced', handleErpSyncEvent);
                    window.removeEventListener('cdi-force-sync', handleErpSyncEvent);
                    document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
                }
            };
        }
    }, []);

    return { supabaseData, setSupabaseData };
};
