import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { deepSanitize, formatSafeErrorMessage } from '../utils/security';

/**
 * Detecta si un registro pertenece al almacenamiento maestro de Listas de Empaque
 */
const isPackingListRecord = (rowOrObj) => {
    if (!rowOrObj || typeof rowOrObj !== 'object') return false;
    const idStr = String(rowOrObj.id || '').trim().toUpperCase();
    const codeStr = String(rowOrObj.codigo_item || rowOrObj.codArticulo || '').trim().toUpperCase();
    const dataObj = rowOrObj.data_completa && typeof rowOrObj.data_completa === 'object'
        ? rowOrObj.data_completa
        : rowOrObj;
    return (
        codeStr === 'PACKING_LIST_MASTER' ||
        dataObj?.tipoRegistro === 'PACKING_LIST' ||
        idStr.startsWith('PACKLIST_')
    );
};

/**
 * Reconstruye listas de empaque desde las órdenes de planta (`produccion_pedidos`)
 * para aquellos pedidos cuyos productos ya fueron empacados / transferidos a Despachos
 * pero cuya lista de empaque original solo existía en el localStorage de otro equipo.
 */
const reconstructPackingListsFromOrders = (plantOrders = []) => {
    const byPedido = new Map();

    plantOrders.forEach((ord) => {
        if (!ord || !ord.pedidoNum) return;
        const pedNum = String(ord.pedidoNum).trim().toUpperCase();
        if (!pedNum) return;

        if (!byPedido.has(pedNum)) {
            byPedido.set(pedNum, []);
        }
        byPedido.get(pedNum).push(ord);
    });

    const reconstructed = [];

    byPedido.forEach((ordersOfPed, pedNum) => {
        // Si alguna orden ya guarda un snapshot completo de la lista de empaque, usarlo prioritariamente
        const withSnapshot = ordersOfPed.find(
            (o) => o.packingListSnapshot && typeof o.packingListSnapshot === 'object' && Array.isArray(o.packingListSnapshot.packages)
        );
        if (withSnapshot) {
            reconstructed.push({
                ...withSnapshot.packingListSnapshot,
                id: `PACKLIST_PED_${pedNum}`,
                tipoRegistro: 'PACKING_LIST',
                pedidoNum: pedNum
            });
            return;
        }

        // Verificar si al menos un producto del pedido tiene marca de haber sido empacado
        const packedOrders = ordersOfPed.filter(
            (o) => Boolean(o.packingListCompletada) || (o.resumenEmpaque && typeof o.resumenEmpaque === 'object')
        );
        if (packedOrders.length === 0) return;

        const firstOrd = packedOrders[0] || ordersOfPed[0];
        const cliente = firstOrd.cliente || 'CLIENTE GENERAL';
        const proyecto = firstOrd.nombre_proyecto || '';

        // Determinar si todos los productos del pedido en planta ya salieron de Empaque (Terminada) o siguen activos
        const allFinishedEmpaque = ordersOfPed.every((o) => {
            const area = String(o.areaActual || '').trim().toUpperCase();
            const est = String(o.estadoInterno || '').trim().toUpperCase();
            return (
                Boolean(o.packingListCompletada) ||
                area === 'DESPACHOS' ||
                area === 'DESPACHADO' ||
                est === 'DESPACHADO' ||
                est === 'ENTREGADO' ||
                Boolean(o.isTerminado)
            );
        });

        // Reconstruir los bultos a partir de `resumenEmpaque` de cada producto empacado
        const pkgMap = new Map();
        let latestTransferDate = null;

        packedOrders.forEach((o, idx) => {
            const res = o.resumenEmpaque || {};
            if (res.fechaTransferenciaDespachos) {
                if (!latestTransferDate || res.fechaTransferenciaDespachos > latestTransferDate) {
                    latestTransferDate = res.fechaTransferenciaDespachos;
                }
            }
            const bultosCodes = Array.isArray(res.bultosProducto) && res.bultosProducto.length > 0
                ? res.bultosProducto
                : [`PAQ-${String(idx + 1).padStart(2, '0')}`];

            const totalQty = Number(o.cantidad) || 1;
            const qtyPerPkg = Math.max(1, Math.round(totalQty / bultosCodes.length));

            bultosCodes.forEach((code, bIdx) => {
                const normCode = String(code || `PAQ-${bIdx + 1}`).trim().toUpperCase();
                if (!pkgMap.has(normCode)) {
                    pkgMap.set(normCode, {
                        id: `PKG_REC_${pedNum}_${pkgMap.size + 1}`,
                        consecutivo: pkgMap.size + 1,
                        tipoEmpaque: normCode.startsWith('CAJ') ? 'Caja' : normCode.startsWith('EST') ? 'Estiba' : 'Paquete',
                        codigoPaquete: normCode,
                        creadoEn: res.fechaTransferenciaDespachos || new Date().toISOString(),
                        observaciones: '',
                        items: []
                    });
                }
                const pkgObj = pkgMap.get(normCode);
                pkgObj.items.push({
                    orderId: o.id,
                    itemKey: `${o.id}__${o.codArticulo || 'S/C'}`,
                    codArticulo: o.codArticulo || o.codigo_item || 'S/C',
                    nombre: o.nombre || o.descripcion || 'PRODUCTO EMPACADO',
                    cantidadTotalPedido: totalQty,
                    cantidadTotalItem: totalQty,
                    cantidadEmpacada: bIdx === 0 ? totalQty : qtyPerPkg,
                    cantidadEnEsteBulto: bIdx === 0 ? totalQty : qtyPerPkg,
                    cantidadMostradaBulto: bIdx === 0 ? totalQty : qtyPerPkg,
                    esSubpaqueteAdicional: bIdx > 0,
                    transferidoADespachos: true,
                    fechaTransferencia: res.fechaTransferenciaDespachos || new Date().toISOString()
                });
            });
        });

        const reconstructedPackages = Array.from(pkgMap.values());
        const timestamp = latestTransferDate || new Date().toISOString();
        const existingRes = firstOrd?.resumenEmpaque || {};
        const existingLog = firstOrd?.datos_logistica || {};

        reconstructed.push({
            id: `PACKLIST_PED_${pedNum}`,
            tipoRegistro: 'PACKING_LIST',
            pedidoNum: pedNum,
            cliente,
            proyecto,
            consecutivoEmpaqueNum: existingRes.consecutivoEmpaqueNum || undefined,
            numeroEmpaque: existingRes.numeroEmpaque || existingLog.numeroEmpaque || undefined,
            codigoRemision: existingRes.codigoRemision || existingLog.guiaRemesa || undefined,
            estadoLista: allFinishedEmpaque ? 'TERMINADA' : 'ACTIVA',
            creadoEn: timestamp,
            actualizadoEn: timestamp,
            fechaCierre: allFinishedEmpaque ? timestamp : undefined,
            creadoPor: 'PLANTA / EMPAQUE',
            nextConsecutive: reconstructedPackages.length + 1,
            packages: reconstructedPackages,
            esReconstruida: true
        });
    });

    return reconstructed;
};

/**
 * Extrae el número entero de un código consecutivo tipo EMP-0005 o REM-0005
 */
const extractConsecutiveNumber = (val) => {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) return Math.floor(val);
    const str = String(val || '').trim();
    const match = str.match(/^(?:EMP|REM)-0*(\d+)$/i);
    if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }
    return 0;
};

/**
 * Fusiona y deduplica listas de empaque por `pedidoNum`, priorizando siempre:
 * 1) Las listas reales sobre las reconstruidas
 * 2) Entre dos listas reales del mismo pedido, la que tenga fecha `actualizadoEn` / `fechaCierre` más reciente
 *    (o estado `TERMINADA` más reciente)
 * 3) Garantiza que toda lista de empaque tenga su consecutivo automático `numeroEmpaque` (EMP-XXXX) y `codigoRemision` (REM-XXXX)
 */
const mergeAndDeduplicatePackingLists = (localLists = [], remoteLists = [], reconstructedLists = []) => {
    const byPedido = new Map();

    const getTimestamp = (item) => {
        if (!item) return 0;
        const raw = item.actualizadoEn || item.fechaCierre || item.creadoEn || 0;
        const parsed = new Date(raw).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
    };

    const getCreationTimestamp = (item) => {
        if (!item) return 0;
        const raw = item.creadoEn || item.actualizadoEn || item.fechaCierre || 0;
        const parsed = new Date(raw).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
    };

    const pickBetterList = (curr, candidate) => {
        if (!curr) return candidate;
        if (!candidate) return curr;

        const preservedConsec =
            curr.consecutivoEmpaqueNum ||
            candidate.consecutivoEmpaqueNum ||
            extractConsecutiveNumber(curr.numeroEmpaque) ||
            extractConsecutiveNumber(candidate.numeroEmpaque) ||
            undefined;
        const preservedNumEmp = curr.numeroEmpaque || candidate.numeroEmpaque || undefined;
        const preservedCodRem = curr.codigoRemision || candidate.codigoRemision || undefined;

        const withPreservedSeq = (winner) => ({
            ...winner,
            consecutivoEmpaqueNum: winner.consecutivoEmpaqueNum || preservedConsec,
            numeroEmpaque: winner.numeroEmpaque || preservedNumEmp,
            codigoRemision: winner.codigoRemision || preservedCodRem
        });

        // Preferir lista real sobre lista reconstruida automáticamente
        if (curr.esReconstruida && !candidate.esReconstruida) return withPreservedSeq(candidate);
        if (!curr.esReconstruida && candidate.esReconstruida) return withPreservedSeq(curr);

        const currTime = getTimestamp(curr);
        const candTime = getTimestamp(candidate);

        // Si una está TERMINADA y su timestamp es mayor o igual, gana TERMINADA
        if (candidate.estadoLista === 'TERMINADA' && curr.estadoLista !== 'TERMINADA' && candTime >= currTime) {
            return withPreservedSeq(candidate);
        }
        if (curr.estadoLista === 'TERMINADA' && candidate.estadoLista !== 'TERMINADA' && currTime >= candTime) {
            return withPreservedSeq(curr);
        }

        if (candTime > currTime) return withPreservedSeq(candidate);
        if (currTime > candTime) return withPreservedSeq(curr);

        // En caso de empate de fecha, preferir la que tenga más bultos registrados
        const currPkgs = Array.isArray(curr.packages) ? curr.packages.length : 0;
        const candPkgs = Array.isArray(candidate.packages) ? candidate.packages.length : 0;
        return withPreservedSeq(candPkgs >= currPkgs ? candidate : curr);
    };

    const ingest = (listArr) => {
        (listArr || []).forEach((item) => {
            if (!item || typeof item !== 'object' || !item.pedidoNum) return;
            const pedNum = String(item.pedidoNum).trim().toUpperCase();
            if (!pedNum) return;
            const normalizedItem = {
                ...item,
                id: `PACKLIST_PED_${pedNum}`,
                pedidoNum: pedNum,
                tipoRegistro: 'PACKING_LIST'
            };
            const existing = byPedido.get(pedNum);
            byPedido.set(pedNum, pickBetterList(existing, normalizedItem));
        });
    };

    ingest(reconstructedLists);
    ingest(localLists);
    ingest(remoteLists);

    const mergedArr = Array.from(byPedido.values());

    // Asignación determinística de consecutivo de Número de Empaque (EMP-XXXX) y Código de Remisión (REM-XXXX)
    const usedNumbers = new Set();
    mergedArr.forEach((item) => {
        const num =
            extractConsecutiveNumber(item.consecutivoEmpaqueNum) ||
            extractConsecutiveNumber(item.numeroEmpaque) ||
            extractConsecutiveNumber(item.codigoRemision);
        if (num > 0) {
            usedNumbers.add(num);
            item.consecutivoEmpaqueNum = num;
            if (!item.numeroEmpaque) item.numeroEmpaque = `EMP-${String(num).padStart(4, '0')}`;
            if (!item.codigoRemision) item.codigoRemision = `REM-${String(num).padStart(4, '0')}`;
        }
    });

    // Ordenar cronológicamente (más antiguo primero) las listas que aún no tenían consecutivo asignado
    const missingSeqLists = mergedArr
        .filter((item) => !item.consecutivoEmpaqueNum || !item.numeroEmpaque || !item.codigoRemision)
        .sort((a, b) => {
            const diff = getCreationTimestamp(a) - getCreationTimestamp(b);
            if (diff !== 0) return diff;
            return String(a.pedidoNum).localeCompare(String(b.pedidoNum), undefined, { numeric: true });
        });

    let nextCandidate = 1;
    missingSeqLists.forEach((item) => {
        while (usedNumbers.has(nextCandidate)) {
            nextCandidate += 1;
        }
        usedNumbers.add(nextCandidate);
        item.consecutivoEmpaqueNum = nextCandidate;
        item.numeroEmpaque = item.numeroEmpaque || `EMP-${String(nextCandidate).padStart(4, '0')}`;
        item.codigoRemision = item.codigoRemision || `REM-${String(nextCandidate).padStart(4, '0')}`;
        nextCandidate += 1;
    });

    return mergedArr.sort((a, b) => getTimestamp(b) - getTimestamp(a));
};

/**
 * Detecta si un registro en `produccion_pedidos` pertenece a la extinta área
 * "Programación y Diseño" o fue volcado automáticamente desde el Excel de Ribisoft
 * sin haber sido ingresado explícitamente a planta por un usuario.
 */
export const isUnassignedErpBulkImport = (orderObj) => {
    if (!orderObj || typeof orderObj !== 'object') return false;
    if (isPackingListRecord(orderObj)) return false;

    const rawArea = String(orderObj.areaActual || '').trim().toUpperCase();
    if (
        rawArea.includes('PROGRAMACIÓN Y DISEÑO') ||
        rawArea.includes('PROGRAMACION Y DISENO') ||
        rawArea.includes('DISEÑO Y PROGRAMACIÓN') ||
        rawArea.includes('DISENO Y PROGRAMACION')
    ) {
        return true;
    }

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
    const [packingLists, setPackingLists] = useState(() => {
        try {
            const raw = localStorage.getItem('cdi_packing_lists_v1');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    });

    const liveBroadcastChannelRef = useRef(null);
    const packingListsRef = useRef(packingLists);

    useEffect(() => {
        packingListsRef.current = packingLists;
        try {
            localStorage.setItem('cdi_packing_lists_v1', JSON.stringify(packingLists));
        } catch (e) {
            // Ignorar errores de cuota local
        }
    }, [packingLists]);

    const emitLiveBroadcast = (kind, action, data) => {
        try {
            if (liveBroadcastChannelRef.current) {
                liveBroadcastChannelRef.current.send({
                    type: 'broadcast',
                    event: 'cdi-live-mutation',
                    payload: {
                        kind,
                        action,
                        data,
                        sentAt: Date.now()
                    }
                });
            }
        } catch (err) {
            // No bloquear flujo principal si el broadcast falla
        }
    };

    const syncOrderToSupabase = async (orderObject, isDelete = false) => {
        if (!orderObject || !orderObject.id) return;
        
        let retries = 2;
        while (retries >= 0) {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                if (!sessionData?.session?.user) {
                    alert('🔒 Tu sesión ha expirado. Por favor vuelve a iniciar sesión para guardar cambios.');
                    return;
                }

                let dbError = null;
                if (isDelete) {
                    const { error } = await supabase.from('produccion_pedidos').delete().eq('id', orderObject.id);
                    dbError = error;
                } else {
                    const sanitizedOrder = deepSanitize({
                        ...orderObject,
                        ultimaActualizacionPlanta: new Date().toISOString()
                    });
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
                    if (!dbError) {
                        emitLiveBroadcast('ORDER', 'UPSERT', sanitizedOrder);
                    }
                }
                
                if (isDelete && !dbError) {
                    emitLiveBroadcast('ORDER', 'DELETE', { id: orderObject.id });
                }

                if (dbError) {
                    if (dbError.message?.includes('Failed to fetch') && retries > 0) {
                        retries--;
                        await new Promise(res => setTimeout(res, 1000));
                        continue;
                    }
                    console.error("DB Error al sincronizar orden:", dbError);
                    alert(formatSafeErrorMessage(dbError, 'No se pudo guardar la orden en la base de datos.'));
                }
                break;
            } catch (e) { 
                if (e.message?.includes('Failed to fetch') && retries > 0) {
                    retries--;
                    await new Promise(res => setTimeout(res, 1000));
                    continue;
                }
                console.error("Error al sincronizar orden", e); 
                alert(formatSafeErrorMessage(e, 'Error de red al sincronizar la orden. Verifica tu conexión.'));
                break;
            }
        }
    };

    const syncAlertToSupabase = async (alertObject, isDelete = false) => {
        if (!alertObject || !alertObject.id) return;
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session?.user) return;

            let dbError = null;
            if (isDelete) {
                const { error } = await supabase.from('coordinacion_alertas').delete().eq('id', alertObject.id);
                dbError = error;
                if (!dbError) emitLiveBroadcast('ALERT', 'DELETE', { id: alertObject.id });
            } else {
                const sanitizedAlert = deepSanitize(alertObject);
                const { error } = await supabase.from('coordinacion_alertas').upsert({
                    id: sanitizedAlert.id,
                    data_completa: sanitizedAlert
                });
                dbError = error;
                if (!dbError) emitLiveBroadcast('ALERT', 'UPSERT', sanitizedAlert);
            }
            if (dbError) {
                console.error("DB Error al sincronizar alerta:", dbError);
                alert(formatSafeErrorMessage(dbError, 'No se pudo guardar la alerta en la base de datos.'));
            }
        } catch (e) { console.error("Error al sincronizar alerta", e); }
    };

    const syncPackingListToSupabase = async (packingListObject, isDelete = false) => {
        if (!packingListObject || (!packingListObject.id && !packingListObject.pedidoNum)) return;
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session?.user) return;

            const pedNum = String(packingListObject.pedidoNum || '').trim().toUpperCase();
            const canonicalId = pedNum ? `PACKLIST_PED_${pedNum}` : packingListObject.id;

            if (isDelete) {
                await supabase.from('produccion_pedidos').delete().eq('id', canonicalId);
                if (packingListObject.id && packingListObject.id !== canonicalId) {
                    await supabase.from('produccion_pedidos').delete().eq('id', packingListObject.id);
                }
                await supabase.from('coordinacion_alertas').delete().eq('id', canonicalId).catch(() => {});
                if (packingListObject.id) {
                    await supabase.from('coordinacion_alertas').delete().eq('id', packingListObject.id).catch(() => {});
                }
                emitLiveBroadcast('PACKING_LIST', 'DELETE', { id: canonicalId, pedidoNum: pedNum });
            } else {
                const { esReconstruida, ...cleanObj } = packingListObject;
                const sanitizedPayload = deepSanitize({
                    ...cleanObj,
                    id: canonicalId,
                    pedidoNum: pedNum,
                    tipoRegistro: 'PACKING_LIST',
                    actualizadoEn: packingListObject.actualizadoEn || new Date().toISOString()
                });

                // 1. Guardado Primario en `produccion_pedidos` (Accesible para el 100% de los computadores de planta)
                const { error: pedErr } = await supabase.from('produccion_pedidos').upsert({
                    id: canonicalId,
                    pedido_num: `PACKLIST_${pedNum}`,
                    cliente: sanitizedPayload.cliente || 'CLIENTE CDI',
                    codigo_item: 'PACKING_LIST_MASTER',
                    areas_compartidas: [],
                    asignado_a: [],
                    data_completa: sanitizedPayload
                });

                if (pedErr) {
                    console.error('Error guardando lista de empaque en produccion_pedidos:', pedErr);
                }

                // 2. Guardado Secundario en `coordinacion_alertas` por respaldo
                await supabase.from('coordinacion_alertas').upsert({
                    id: canonicalId,
                    data_completa: sanitizedPayload
                }).catch(() => {});

                // 3. Emitir actualización en vivo a todos los demás computadores abiertos
                emitLiveBroadcast('PACKING_LIST', 'UPSERT', sanitizedPayload);
            }
        } catch (e) {
            console.error("Error al sincronizar lista de empaque:", e);
        }
    };

    useEffect(() => {
        let isFetchingProduccion = false;
        let lastFetchProduccionAt = 0;

        const fetchProduccion = async (force = false) => {
            const now = Date.now();
            if (isFetchingProduccion) return;
            if (!force && lastFetchProduccionAt > 0 && now - lastFetchProduccionAt < 2500) {
                return;
            }
            isFetchingProduccion = true;
            try {
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

                const validPlantOrders = [];
                const remotePackingListsFromPedidos = [];
                const autoImportedIdsToPurge = [];

                if (allPedidosRows.length > 0) {
                    for (const row of allPedidosRows) {
                        if (!row?.data_completa || typeof row.data_completa !== 'object') continue;
                        const d = { ...row.data_completa };

                        // Separar registros maestros de Listas de Empaque guardados en `produccion_pedidos`
                        if (isPackingListRecord(row) || isPackingListRecord(d)) {
                            if (d.pedidoNum) {
                                remotePackingListsFromPedidos.push({
                                    ...d,
                                    id: `PACKLIST_PED_${String(d.pedidoNum).trim().toUpperCase()}`,
                                    pedidoNum: String(d.pedidoNum).trim().toUpperCase(),
                                    tipoRegistro: 'PACKING_LIST'
                                });
                            }
                            continue;
                        }

                        if (row.codigo_item && !d.codArticulo) {
                            d.codArticulo = row.codigo_item;
                            d.codigo_item = row.codigo_item;
                        }
                        if (!d.id || !d.pedidoNum) continue;

                        if (isUnassignedErpBulkImport(d)) {
                            autoImportedIdsToPurge.push(row.id || d.id);
                            continue;
                        }

                        validPlantOrders.push(d);
                    }

                    setOrders(validPlantOrders);

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
                
                let remotePackingListsFromAlertas = [];
                try {
                    const { data: alertasData } = await supabase.from('coordinacion_alertas').select('data_completa');
                    if (alertasData) {
                        const allRows = alertasData
                            .map(row => row.data_completa)
                            .filter(a => a && typeof a === 'object' && a.id);

                        const remoteAlerts = allRows.filter(a => a.tipoRegistro !== 'PACKING_LIST' && a.pedidoNum);
                        remotePackingListsFromAlertas = allRows.filter(a => a.tipoRegistro === 'PACKING_LIST' && a.pedidoNum);
                        setCoordinationAlerts(remoteAlerts);
                    }
                } catch (_) {}

                // Combinar listas remotas (desde produccion_pedidos + coordinacion_alertas), listas locales y reconstruidas desde órdenes
                const allRemotePacking = [...remotePackingListsFromAlertas, ...remotePackingListsFromPedidos];
                const reconstructedFromOrders = reconstructPackingListsFromOrders(validPlantOrders);
                const remotePedidosSet = new Set(
                    remotePackingListsFromPedidos.map(p => String(p.pedidoNum || '').trim().toUpperCase())
                );

                const currentLocalLists = packingListsRef.current || [];
                const mergedPackingLists = mergeAndDeduplicatePackingLists(
                    currentLocalLists,
                    allRemotePacking,
                    reconstructedFromOrders
                );

                setPackingLists(mergedPackingLists);

                // Auto-sincronizar hacia `produccion_pedidos` cualquier lista que exista localmente o haya sido reconstruida
                // pero que aún no esté guardada en `produccion_pedidos` (para que todos los demás computadores la vean de inmediato)
                const listsToPushToCloud = mergedPackingLists.filter(item => {
                    const ped = String(item.pedidoNum || '').trim().toUpperCase();
                    if (!ped) return false;
                    if (!remotePedidosSet.has(ped)) return true;
                    const remoteMatch = remotePackingListsFromPedidos.find(
                        r => String(r.pedidoNum || '').trim().toUpperCase() === ped
                    );
                    if (!remoteMatch) return true;
                    const localTime = new Date(item.actualizadoEn || item.fechaCierre || 0).getTime() || 0;
                    const remoteTime = new Date(remoteMatch.actualizadoEn || remoteMatch.fechaCierre || 0).getTime() || 0;
                    return localTime > remoteTime;
                });

                if (listsToPushToCloud.length > 0) {
                    (async () => {
                        for (const listItem of listsToPushToCloud) {
                            await syncPackingListToSupabase(listItem, false);
                        }
                    })();
                }

                lastFetchProduccionAt = Date.now();
            } catch (err) {
                console.error('Error fetching produccion:', err);
            } finally {
                isFetchingProduccion = false;
            }
        };

        fetchProduccion(true);
        
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                fetchProduccion(true);
            }
        });

        const handleForceSyncEvent = () => {
            fetchProduccion(true);
        };

        const handleVisibilityOrFocus = () => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') {
                fetchProduccion(true);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('cdi-erp-synced', handleForceSyncEvent);
            window.addEventListener('cdi-force-sync', handleForceSyncEvent);
            window.addEventListener('focus', handleVisibilityOrFocus);
            document.addEventListener('visibilitychange', handleVisibilityOrFocus);
        }

        // Polling silencioso cada 8 segundos cuando la ventana está visible para garantizar sincronización continua en toda la planta
        const pollInterval = setInterval(() => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') {
                fetchProduccion(true);
            }
        }, 8000);

        const applyIncomingOrder = (newData) => {
            if (!newData || !newData.id) return;
            if (isPackingListRecord(newData)) {
                setPackingLists(prev => mergeAndDeduplicatePackingLists(prev, [newData], []));
                return;
            }
            if (isUnassignedErpBulkImport(newData)) return;

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
        };

        const handleProduccionPayload = async (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                let newData = payload.new?.data_completa;
                const rowId = payload.new?.id;

                // Si Supabase Realtime truncó `data_completa` por tamaño de JSONB, consultamos la fila puntual
                if ((!newData || !newData.id) && rowId) {
                    try {
                        const { data: singleRow } = await supabase
                            .from('produccion_pedidos')
                            .select('id, codigo_item, data_completa')
                            .eq('id', rowId)
                            .single();
                        if (singleRow?.data_completa) {
                            newData = singleRow.data_completa;
                        }
                    } catch (_) {}
                }

                if (newData) {
                    applyIncomingOrder(newData);
                } else {
                    fetchProduccion(true);
                }
            } else if (payload.eventType === 'DELETE') {
                const oldId = payload.old?.id;
                if (oldId) {
                    if (String(oldId).startsWith('PACKLIST_')) {
                        setPackingLists(prev => prev.filter(p => p.id !== oldId));
                    } else {
                        setOrders(prev => prev.filter(o => o.id !== oldId));
                    }
                }
            }
        };

        const handleAlertasPayload = (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const newData = payload.new?.data_completa;
                if (!newData || !newData.id) {
                    fetchProduccion(true);
                    return;
                }

                if (newData.tipoRegistro === 'PACKING_LIST') {
                    setPackingLists(prev => mergeAndDeduplicatePackingLists(prev, [newData], []));
                    return;
                }
                
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
                    setPackingLists(prev => prev.filter(p => p.id !== oldId));
                }
            }
        };

        const subPedidos = supabase.channel('pedidos-channel-v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'produccion_pedidos' }, handleProduccionPayload)
            .subscribe();
            
        const subAlertas = supabase.channel('alertas-channel-v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinacion_alertas' }, handleAlertasPayload)
            .subscribe();

        const liveBroadcastChannel = supabase.channel('cdi-live-sync-v2', {
            config: { broadcast: { self: false } }
        })
            .on('broadcast', { event: 'cdi-live-mutation' }, ({ payload }) => {
                if (!payload) return;
                if (payload.kind === 'ORDER') {
                    if (payload.action === 'DELETE' && payload.data?.id) {
                        setOrders(prev => prev.filter(o => o.id !== payload.data.id));
                    } else if (payload.data) {
                        applyIncomingOrder(payload.data);
                    }
                } else if (payload.kind === 'PACKING_LIST') {
                    if (payload.action === 'DELETE') {
                        setPackingLists(prev => prev.filter(
                            p => p.id !== payload.data?.id && String(p.pedidoNum).toUpperCase() !== String(payload.data?.pedidoNum).toUpperCase()
                        ));
                    } else if (payload.data) {
                        setPackingLists(prev => mergeAndDeduplicatePackingLists(prev, [payload.data], []));
                    }
                }
                // Respaldo de consistencia tras recibir notificación broadcast
                fetchProduccion(true);
            })
            .subscribe();

        liveBroadcastChannelRef.current = liveBroadcastChannel;

        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(subPedidos);
            supabase.removeChannel(subAlertas);
            supabase.removeChannel(liveBroadcastChannel);
            liveBroadcastChannelRef.current = null;
            authListener?.subscription?.unsubscribe();
            if (typeof window !== 'undefined') {
                window.removeEventListener('cdi-erp-synced', handleForceSyncEvent);
                window.removeEventListener('cdi-force-sync', handleForceSyncEvent);
                window.removeEventListener('focus', handleVisibilityOrFocus);
                document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
            }
        };
    }, []);

    return {
        orders,
        setOrders,
        coordinationAlerts,
        setCoordinationAlerts,
        packingLists,
        setPackingLists,
        syncOrderToSupabase,
        syncAlertToSupabase,
        syncPackingListToSupabase
    };
};
