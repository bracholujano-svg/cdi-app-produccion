import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import localforage from 'localforage';

const MRP_PROCESSED_CACHE_KEY = 'cdi_mrp_processed_cache_v3';
const MRP_RAW_INV_CACHE_KEY = 'cdi_mrp_raw_inv_v1';
const MRP_RAW_REQ_CACHE_KEY = 'cdi_mrp_raw_req_v1';
const MRP_LAST_SYNC_KEY = 'last_sync_mrp';
const MRP_DELTA_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas
const MRP_FALLBACK_TTL_MS = 30 * 60 * 1000; // 30 minutos si la tabla no tiene `updated_at`

// Proyecciones explícitas de columnas verificadas en PostgreSQL (sin `select('*')` para minimizar Egress)
const INVENTARIO_MRP_COLS =
    '"Id Referencia", referencia, "Referencia", existencia, "Saldo", ubicacion, "Ubicacion", grupo, subgrupo, linea, "Id Unidad", embalaje';
const REQUERIMIENTOS_MRP_COLS =
    'id, numero_rq, pedido_cot, pedido_sin, pedidosin, codpt, producto, idreferencia, referencia, idunidad, fecha_solicitud, pedida_reser, cant_oc, entregada, pendiente, existencia, ubicacion';

const getSelectColsForMrpTable = (table) =>
    table === 'inventario' ? INVENTARIO_MRP_COLS : REQUERIMIENTOS_MRP_COLS;

const getInvKey = (r) => r?.id ?? r?.idreferencia ?? r?.id_referencia ?? r?.['Id Referencia'];
const getReqKey = (r) =>
    r?.id ?? `${r?.numero_rq || ''}_${r?.pedido_sin || ''}_${r?.idreferencia || ''}`;

const isMissingUpdatedAtError = (err) => {
    if (!err) return false;
    const code = String(err.code || '');
    const msg = String(err.message || err.details || err.hint || '').toLowerCase();
    return code === '42703' || (msg.includes('updated_at') && (msg.includes('does not exist') || msg.includes('column')));
};

const mergeRowsByKey = (baseRows = [], incomingRows = [], keyFn) => {
    const map = new Map();
    (baseRows || []).forEach((item) => {
        const k = keyFn(item);
        if (k !== undefined && k !== null && k !== '') map.set(k, item);
    });
    (incomingRows || []).forEach((item) => {
        const k = keyFn(item);
        if (k !== undefined && k !== null && k !== '') {
            const prev = map.get(k);
            map.set(k, prev ? { ...prev, ...item } : item);
        }
    });
    return Array.from(map.values());
};

export const useSupabaseData = () => {
    const [supabaseData, setSupabaseData] = useState(null);
    const workerRef = useRef(null);
    const isFetchingRef = useRef(false);
    const lastFullFetchAtRef = useRef(0);
    const rawInvRef = useRef(null);
    const rawReqRef = useRef(null);
    const triggerMrpDeltaRef = useRef(null);
    const missingUpdatedAtTablesRef = useRef(new Set());

    useEffect(() => {
        let isMounted = true;
        // Inicializar Worker
        workerRef.current = new Worker(new URL('../workers/mrpWorker.js', import.meta.url), { type: 'module' });
        
        workerRef.current.onmessage = (e) => {
            if (!isMounted) return;
            if (e.data.status === 'success') {
                setSupabaseData(e.data.data);
                // Guardar el resultado final procesado en el caché para carga instantánea futura (0 ms)
                localforage.setItem(MRP_PROCESSED_CACHE_KEY, e.data.data).catch(() => {});
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

        const persistRawMrpToCache = (invData, reqData) => {
            const nowIso = new Date().toISOString();
            if (Array.isArray(invData)) {
                localforage.setItem(MRP_RAW_INV_CACHE_KEY, invData).catch(() => {});
            }
            if (Array.isArray(reqData)) {
                localforage.setItem(MRP_RAW_REQ_CACHE_KEY, reqData).catch(() => {});
            }
            localforage.setItem(MRP_LAST_SYNC_KEY, nowIso).catch(() => {});
            localforage.setItem('cdi_mrp_processed_cache_ts_v3', Date.now()).catch(() => {});
        };

        const fetchAll = async (table, maxRows = 10000) => {
            let allData = [];
            let from = 0;
            const step = 1000;
            let hasMore = true;
            const selectCols = getSelectColsForMrpTable(table);
            while (hasMore && allData.length < maxRows) {
                let query = supabase
                    .from(table)
                    .select(selectCols);
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

        const fetchTableDelta = async (table, deltaCursor, maxRows = 2000) => {
            if (missingUpdatedAtTablesRef.current.has(table)) {
                return { supported: false, rows: [] };
            }
            try {
                const selectCols = getSelectColsForMrpTable(table);
                let query = supabase
                    .from(table)
                    .select(`${selectCols}, updated_at`)
                    .gt('updated_at', deltaCursor)
                    .limit(maxRows);
                if (table === 'requerimientos_pedido') {
                    query = query
                        .not('pedido_sin', 'is', null)
                        .not('idreferencia', 'is', null);
                }
                const { data, error } = await query;
                if (error) {
                    if (isMissingUpdatedAtError(error)) {
                        missingUpdatedAtTablesRef.current.add(table);
                        return { supported: false, rows: [] };
                    }
                    return { supported: true, error, rows: [] };
                }
                return { supported: true, rows: data || [] };
            } catch (err) {
                if (isMissingUpdatedAtError(err)) {
                    missingUpdatedAtTablesRef.current.add(table);
                    return { supported: false, rows: [] };
                }
                return { supported: true, error: err, rows: [] };
            }
        };

        const loadFromCacheAndFetch = async ({ forceFull = false, forceDelta = false } = {}) => {
            const now = Date.now();
            if (isFetchingRef.current) return;
            if (!forceFull && !forceDelta && lastFullFetchAtRef.current > 0 && now - lastFullFetchAtRef.current < 120000) {
                return;
            }
            isFetchingRef.current = true;

            try {
                // 0. Bloqueo estricto sin sesión: no realizar NINGÚN fetch a Supabase si no existe usuario autenticado
                const { data: sessionData } = await supabase.auth.getSession();
                if (!sessionData?.session?.user) {
                    return;
                }

                // 1. Carga instantánea Cache-First (0 ms) desde localforage
                const [cachedProcessed, cachedRawInv, cachedRawReq, lastSyncIso] = await Promise.all([
                    localforage.getItem(MRP_PROCESSED_CACHE_KEY),
                    localforage.getItem(MRP_RAW_INV_CACHE_KEY),
                    localforage.getItem(MRP_RAW_REQ_CACHE_KEY),
                    localforage.getItem(MRP_LAST_SYNC_KEY)
                ]);

                if (isMounted && cachedProcessed) {
                    setSupabaseData((prev) => prev || cachedProcessed);
                }
                if (!rawInvRef.current && Array.isArray(cachedRawInv)) {
                    rawInvRef.current = cachedRawInv;
                }
                if (!rawReqRef.current && Array.isArray(cachedRawReq)) {
                    rawReqRef.current = cachedRawReq;
                }

                const lastSyncMs = lastSyncIso ? new Date(lastSyncIso).getTime() : 0;
                const hasRawCache =
                    Array.isArray(rawInvRef.current) &&
                    rawInvRef.current.length > 0 &&
                    Array.isArray(rawReqRef.current) &&
                    rawReqRef.current.length > 0;
                const hasValidDeltaWindow =
                    !forceFull &&
                    hasRawCache &&
                    Number.isFinite(lastSyncMs) &&
                    lastSyncMs > 0 &&
                    (now - lastSyncMs) < MRP_DELTA_MAX_AGE_MS;

                // 2. Consulta Delta (Solo cambios posteriores a `last_sync_mrp`)
                if (hasValidDeltaWindow) {
                    const deltaCursor = new Date(Math.max(0, lastSyncMs - 5000)).toISOString();
                    const [invDelta, reqDelta] = await Promise.all([
                        fetchTableDelta('inventario', deltaCursor, 2000),
                        fetchTableDelta('requerimientos_pedido', deltaCursor, 2000)
                    ]);

                    if (invDelta.supported && reqDelta.supported) {
                        const changedInv = invDelta.rows.length > 0;
                        const changedReq = reqDelta.rows.length > 0;
                        if (changedInv) {
                            rawInvRef.current = mergeRowsByKey(rawInvRef.current, invDelta.rows, getInvKey);
                        }
                        if (changedReq) {
                            rawReqRef.current = mergeRowsByKey(rawReqRef.current, reqDelta.rows, getReqKey);
                        }
                        lastFullFetchAtRef.current = Date.now();
                        persistRawMrpToCache(rawInvRef.current, rawReqRef.current);
                        if (changedInv || changedReq || !cachedProcessed) {
                            dispatchToWorker(rawInvRef.current, rawReqRef.current);
                        }
                        return;
                    }

                    // Fallback seguro si `inventario` o `requerimientos_pedido` no tienen `updated_at`:
                    // respetar caché local fresca (< 30 min) para NO re-descargar miles de filas repetitivamente
                    if ((now - lastSyncMs) < MRP_FALLBACK_TTL_MS) {
                        lastFullFetchAtRef.current = lastSyncMs;
                        return;
                    }
                }

                // 3. Carga base inicial (solo si no existe caché local, superó 24h/TTL o tras importar Excel ERP)
                const [inv, req] = await Promise.all([
                    fetchAll('inventario', 6000),
                    fetchAll('requerimientos_pedido', 10000)
                ]);

                if (inv && req) {
                    rawInvRef.current = inv;
                    rawReqRef.current = req;
                    lastFullFetchAtRef.current = Date.now();
                    persistRawMrpToCache(inv, req);
                    dispatchToWorker(inv, req);
                }
            } catch(e) {
                console.error("Error fetching Supabase", e);
            } finally {
                isFetchingRef.current = false;
            }
        };

        triggerMrpDeltaRef.current = () => loadFromCacheAndFetch({ forceDelta: true });

        // Arranque inmediato: Cache-First (0 ms) + Delta Sync
        loadFromCacheAndFetch({ forceDelta: true });
        
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                loadFromCacheAndFetch({ forceDelta: true });
            }
        });

        const handleErpSyncEvent = () => {
            loadFromCacheAndFetch({ forceFull: true });
        };
        const handleForceSyncEvent = () => {
            loadFromCacheAndFetch({ forceDelta: true });
        };
        const handleVisibilityOrFocus = () => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') {
                loadFromCacheAndFetch({ forceDelta: false });
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('cdi-erp-synced', handleErpSyncEvent);
            window.addEventListener('cdi-force-sync', handleForceSyncEvent);
            document.addEventListener('visibilitychange', handleVisibilityOrFocus);
        }
        
        let workerDebounceTimeout;
        const scheduleWorkerReprocess = () => {
            clearTimeout(workerDebounceTimeout);
            workerDebounceTimeout = setTimeout(() => {
                if (rawInvRef.current && rawReqRef.current) {
                    persistRawMrpToCache(rawInvRef.current, rawReqRef.current);
                    dispatchToWorker(rawInvRef.current, rawReqRef.current);
                } else {
                    loadFromCacheAndFetch({ forceDelta: false });
                }
            }, 900);
        };

        // Realtime -> React + localforage (`last_sync_mrp`) de manera 100% incremental
        const handleRealtimeInventario = (payload) => {
            if (!rawInvRef.current || !payload) {
                scheduleWorkerReprocess();
                return;
            }
            if (payload.eventType === 'INSERT' && payload.new) {
                rawInvRef.current = mergeRowsByKey(rawInvRef.current, [payload.new], getInvKey);
            } else if (payload.eventType === 'UPDATE' && payload.new) {
                const kNew = getInvKey(payload.new);
                rawInvRef.current = rawInvRef.current.map((item) =>
                    getInvKey(item) === kNew ? { ...item, ...payload.new } : item
                );
            } else if (payload.eventType === 'DELETE' && payload.old) {
                const kOld = getInvKey(payload.old);
                rawInvRef.current = rawInvRef.current.filter((item) => getInvKey(item) !== kOld);
            }
            scheduleWorkerReprocess();
        };

        const handleRealtimeRequerimientos = (payload) => {
            if (!rawReqRef.current || !payload) {
                scheduleWorkerReprocess();
                return;
            }
            if (payload.eventType === 'INSERT' && payload.new) {
                rawReqRef.current = mergeRowsByKey(rawReqRef.current, [payload.new], getReqKey);
            } else if (payload.eventType === 'UPDATE' && payload.new) {
                const kNew = getReqKey(payload.new);
                rawReqRef.current = rawReqRef.current.map((item) =>
                    getReqKey(item) === kNew ? { ...item, ...payload.new } : item
                );
            } else if (payload.eventType === 'DELETE' && payload.old) {
                const kOld = getReqKey(payload.old);
                rawReqRef.current = rawReqRef.current.filter((item) => getReqKey(item) !== kOld);
            }
            scheduleWorkerReprocess();
        };

        let ribiRealtimeTimeout;
        const handleRealtimeRibisoft = () => {
            clearTimeout(ribiRealtimeTimeout);
            ribiRealtimeTimeout = setTimeout(() => {
                if (typeof window !== 'undefined') {
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
                isMounted = false;
                triggerMrpDeltaRef.current = null;
                clearTimeout(workerDebounceTimeout);
                clearTimeout(ribiRealtimeTimeout);
                supabase.removeChannel(channels); 
                if (workerRef.current) workerRef.current.terminate();
                authListener?.subscription?.unsubscribe();
                if (typeof window !== 'undefined') {
                    window.removeEventListener('cdi-erp-synced', handleErpSyncEvent);
                    window.removeEventListener('cdi-force-sync', handleForceSyncEvent);
                    document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
                }
            };
        } catch(e) {
            return () => {
                isMounted = false;
                triggerMrpDeltaRef.current = null;
                clearTimeout(workerDebounceTimeout);
                clearTimeout(ribiRealtimeTimeout);
                if (workerRef.current) workerRef.current.terminate();
                authListener?.subscription?.unsubscribe();
                if (typeof window !== 'undefined') {
                    window.removeEventListener('cdi-erp-synced', handleErpSyncEvent);
                    window.removeEventListener('cdi-force-sync', handleForceSyncEvent);
                    document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
                }
            };
        }
    }, []);

    const syncMrpDelta = useCallback(async () => {
        if (triggerMrpDeltaRef.current) {
            return await triggerMrpDeltaRef.current();
        }
        return null;
    }, []);

    return { supabaseData, setSupabaseData, syncMrpDelta };
};
