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

        const loadFromCacheAndFetch = async (force = false) => {
            const now = Date.now();
            if (isFetchingRef.current) return;
            if (!force && lastFullFetchAtRef.current > 0 && now - lastFullFetchAtRef.current < 4000) {
                return;
            }
            isFetchingRef.current = true;

            try {
                // Ensure the user session is loaded to pass RLS
                await supabase.auth.getSession();
                
                // 1. Mostrar caché primero para que la interfaz cargue rápido
                if (!rawInvRef.current) {
                    const cachedData = await localforage.getItem('cdi_mrp_processed_cache_v3');
                    if (cachedData) {
                        setSupabaseData(cachedData);
                    }
                }

                // 2. Fetch de BD en segundo plano en paralelo
                const fetchAll = async (table) => {
                    let allData = [];
                    let from = 0;
                    const step = 1000;
                    let hasMore = true;
                    while (hasMore) {
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
                    fetchAll('inventario'),
                    fetchAll('requerimientos_pedido')
                ]);

                if (inv && req) {
                    rawInvRef.current = inv;
                    rawReqRef.current = req;
                    lastFullFetchAtRef.current = Date.now();
                    dispatchToWorker(inv, req);
                }
            } catch(e) {
                console.error("Error fetching Supabase", e);
            } finally {
                isFetchingRef.current = false;
            }
        };

        loadFromCacheAndFetch(false);
        
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                loadFromCacheAndFetch(false);
            }
        });

        const handleErpSyncEvent = () => {
            loadFromCacheAndFetch(true);
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('cdi-erp-synced', handleErpSyncEvent);
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

        try {
            const channels = supabase.channel('custom-all-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, handleRealtimeInventario)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos_pedido' }, handleRealtimeRequerimientos)
                .subscribe();
            
            return () => { 
                supabase.removeChannel(channels); 
                if (workerRef.current) workerRef.current.terminate();
                authListener?.subscription?.unsubscribe();
                if (typeof window !== 'undefined') {
                    window.removeEventListener('cdi-erp-synced', handleErpSyncEvent);
                }
            };
        } catch(e) {
            return () => {
                if (workerRef.current) workerRef.current.terminate();
                authListener?.subscription?.unsubscribe();
                if (typeof window !== 'undefined') {
                    window.removeEventListener('cdi-erp-synced', handleErpSyncEvent);
                }
            };
        }
    }, []);

    return { supabaseData, setSupabaseData };
};
