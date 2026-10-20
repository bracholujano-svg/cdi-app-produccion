import localforage from 'localforage';
import { supabase } from '../supabaseClient';

/**
 * Limpia códigos numéricos exportados por Excel con decimales (.0),
 * devolviendo un String entero limpio (ej: 33000070.0 -> '33000070').
 */
export const cleanErpCode = (val) => {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const str = String(val).trim();
  const num = Number(str);
  if (!Number.isNaN(num) && Number.isFinite(num)) {
    return String(Math.trunc(num)).trim();
  }
  return str.replace(/\.0+$/, '').trim();
};

/**
 * Convierte valores numéricos de Excel a Number seguro.
 */
export const toSafeNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  let str = String(val).trim();
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(/,/g, '.');
  } else if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Convierte fechas exportadas por Excel (números seriales como 46120.371527777774,
 * objetos Date o textos DD/MM/YYYY / ISO) a formato ISO 8601 válido para PostgreSQL TIMESTAMPTZ,
 * o devuelve null si el valor está vacío o fuera de rango.
 */
export const cleanExcelDate = (val) => {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) {
    return !Number.isNaN(val.getTime()) ? val.toISOString() : null;
  }

  const str = String(val).trim();
  if (!str || str === '0' || str === '0.0' || str.startsWith('00/00') || str.startsWith('0000-00')) {
    return null;
  }

  const num = Number(str);
  if (!Number.isNaN(num) && Number.isFinite(num)) {
    // Rango válido de fecha serial de Excel (entre 1954 y 2173)
    if (num > 20000 && num < 100000) {
      const utcMs = Math.round((num - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return null;
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY opcionalmente con hora
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const [, day, month, year, hh = '00', mm = '00', ss = '00'] = dmyMatch;
    const isoCandidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}Z`;
    const d = new Date(isoCandidate);
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1970 && d.getUTCFullYear() <= 2100) {
      return d.toISOString();
    }
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() >= 1970 && parsed.getUTCFullYear() <= 2100) {
    return parsed.toISOString();
  }

  return null;
};

/**
 * Normaliza el nombre de un producto para cruce exacto entre
 * MATERIALES REQUERIDOS (columna `producto`) y LISTA DE PEDIDOS (columna `Descripción`).
 */
export const normalizeProductName = (str) =>
  String(str || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

/**
 * Evalúa si una bandera booleana de Excel (Anulado / Descartado) es verdadera.
 */
const isTruthyExcelFlag = (val) => {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const norm = val.trim().toUpperCase();
    return norm === 'TRUE' || norm === 'VERDADERO' || norm === 'SI' || norm === 'SÍ' || norm === '1';
  }
  return false;
};

/**
 * Extrae o limpia el código de producto terminado (3300xxxx) desde la fila de Excel,
 * o lo busca en el mapa de (pedido_sin + producto) -> codpt.
 */
export const extractCodigoItem = (row, prodToCodptMap = null, pedidoSin = null) => {
  const rawCode =
    row['codigo_item'] ??
    row['Código Ítem'] ??
    row['Codigo Item'] ??
    row['codpt'] ??
    row['CodPT'] ??
    row['Código'] ??
    row['Codigo'];

  if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
    const cleaned = cleanErpCode(rawCode);
    if (cleaned && cleaned !== 'NaN') return cleaned;
  }

  const desc = String(row['Descripción'] ?? row['Descripcion'] ?? row['producto'] ?? row['Producto'] ?? '');
  if (prodToCodptMap && pedidoSin) {
    const key = `${pedidoSin}__${normalizeProductName(desc)}`;
    if (prodToCodptMap.has(key)) {
      return prodToCodptMap.get(key);
    }
  }

  const match = desc.match(/\b(33\d{6,}|34\d{6,})\b/);
  return match ? match[1] : null;
};

/**
 * Escribe lotes en Supabase (insert o upsert) adaptándose automáticamente al esquema real
 * de la tabla y evitando errores de columnas inexistentes o claves duplicadas.
 */
const adaptiveBatchWrite = async (
  tableName,
  rows,
  {
    mode = 'insert',
    onConflict = undefined,
    onProgress = null,
    progressStart = 0,
    progressEnd = 100,
    chunkSize = 800
  } = {}
) => {
  if (!rows || rows.length === 0) return 0;

  const excludedColumns = new Set();

  const filterRowColumns = (row) => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) {
      if (!excludedColumns.has(k) && v !== undefined) {
        clean[k] = v;
      }
    }
    return clean;
  };

  let processedTotal = 0;
  let currentMode = mode;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const rawChunk = rows.slice(i, i + chunkSize);
    let retries = 20;

    while (retries > 0) {
      const payload = rawChunk.map(filterRowColumns);
      if (payload.length === 0 || Object.keys(payload[0]).length === 0) {
        throw new Error(`Ninguna columna coincide con el esquema de la tabla ${tableName}.`);
      }

      let query;
      if (currentMode === 'upsert') {
        query = onConflict
          ? supabase.from(tableName).upsert(payload, { onConflict })
          : supabase.from(tableName).upsert(payload);
      } else {
        query = supabase.from(tableName).insert(payload);
      }

      const { error } = await query;
      if (!error) {
        processedTotal += rawChunk.length;
        break;
      }

      // Si PostgREST reporta una columna que no existe en el schema cache, descartarla y reintentar
      const colMatch =
        error.message?.match(/Could not find the '([^']+)' column/i) ||
        error.message?.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);

      if (colMatch && colMatch[1]) {
        excludedColumns.add(colMatch[1]);
        retries--;
        continue;
      }

      // Si una inserción choca con una clave primaria o única existente, cambiar automáticamente a upsert
      if (currentMode === 'insert' && /duplicate key value violates unique constraint/i.test(error.message || '')) {
        currentMode = 'upsert';
        retries--;
        continue;
      }

      throw error;
    }

    if (onProgress) {
      const ratio = Math.min(1, processedTotal / rows.length);
      onProgress(Math.round(progressStart + ratio * (progressEnd - progressStart)));
    }
  }

  return processedTotal;
};

/**
 * Obtiene todas las filas de una tabla de Supabase paginando de 1000 en 1000.
 */
const fetchAllTableRows = async (tableName, selectCols = '*') => {
  let all = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectCols)
      .range(from, from + step - 1);

    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      all = all.concat(data);
      from += step;
      if (data.length < step) hasMore = false;
    }
  }
  return all;
};

/**
 * Elimina registros por lotes de IDs en una tabla de Supabase.
 */
const deleteIdsInBatches = async (tableName, ids, batchSize = 200) => {
  if (!ids || ids.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const { error } = await supabase.from(tableName).delete().in('id', chunk);
    if (!error) deleted += chunk.length;
  }
  return deleted;
};

/**
 * Limpia y elimina todos los registros duplicados existentes en `ribisoft_pedidos`,
 * `produccion_pedidos` y `requerimientos_pedido`, conservando siempre el registro
 * que tiene el código de producto (`Código Ítem` / `codpt`) y los avances de planta.
 */
export const deduplicateErpTables = async (onProgress) => {
  if (onProgress) onProgress(5);

  // 1. Inspeccionar y depurar `requerimientos_pedido` + construir mapa (pedido_sin + producto) -> codpt
  const prodToCodptMap = new Map();
  let requerimientosDuplicatesRemoved = 0;

  try {
    const allReqs = await fetchAllTableRows(
      'requerimientos_pedido',
      'id, numero_rq, pedido_sin, pedidosin, codpt, producto, idreferencia, referencia, entregada, pendiente'
    );

    const reqGroups = new Map();
    const reqIdsToDelete = [];

    for (const r of allReqs) {
      const pSin = cleanErpCode(r.pedido_sin ?? r.pedidosin);
      const idRef = cleanErpCode(r.idreferencia);
      const codpt = cleanErpCode(r.codpt);
      const prodNorm = normalizeProductName(r.producto);
      const rqNum = String(r.numero_rq || '').trim().toUpperCase();

      if (pSin && codpt && prodNorm) {
        prodToCodptMap.set(`${pSin}__${prodNorm}`, codpt);
      }

      // Si es una fila huérfana pre-migración sin pedido_sin o sin idreferencia, marcar para borrar
      if (!pSin || !idRef || !r.pedido_sin || !r.idreferencia) {
        if (r.id) reqIdsToDelete.push(r.id);
        continue;
      }

      const key = `${pSin}__${codpt || ''}__${prodNorm}__${idRef}__${rqNum}`;
      const existing = reqGroups.get(key);

      if (!existing) {
        reqGroups.set(key, r);
      } else {
        // Conservar el registro que tenga `referencia` y `codpt` más completos
        const existingScore = (existing.codpt ? 2 : 0) + (existing.referencia ? 1 : 0);
        const candidateScore = (r.codpt ? 2 : 0) + (r.referencia ? 1 : 0);
        if (candidateScore > existingScore) {
          if (existing.id) reqIdsToDelete.push(existing.id);
          reqGroups.set(key, r);
        } else {
          if (r.id) reqIdsToDelete.push(r.id);
        }
      }
    }

    requerimientosDuplicatesRemoved = await deleteIdsInBatches('requerimientos_pedido', reqIdsToDelete);
  } catch (err) {
    console.warn('Aviso depurando requerimientos_pedido:', err.message);
  }

  if (onProgress) onProgress(35);

  // 2. Inspeccionar y depurar `ribisoft_pedidos` (eliminar filas con Código Ítem EMPTY cuando existe la fila con código, y eliminar repetidos)
  let ribisoftDuplicatesRemoved = 0;
  let codesEnriched = 0;

  try {
    const allRibi = await fetchAllTableRows(
      'ribisoft_pedidos',
      'id, "PedidoSIN", "Código Ítem", "Descripción", "Cliente", "Cantidad"'
    );

    const ribiByPedidoDesc = new Map();
    const ribiIdsToDelete = [];
    const ribiToUpdateCode = [];

    for (const r of allRibi) {
      const pSin = cleanErpCode(r['PedidoSIN']);
      const descNorm = normalizeProductName(r['Descripción']);
      const code = cleanErpCode(r['Código Ítem']);

      if (!pSin) {
        if (r.id) ribiIdsToDelete.push(r.id);
        continue;
      }

      const groupKey = `${pSin}__${descNorm || code || ''}`;
      const existing = ribiByPedidoDesc.get(groupKey);

      if (!existing) {
        ribiByPedidoDesc.set(groupKey, r);
      } else {
        const existingCode = cleanErpCode(existing['Código Ítem']);
        // Priorizar siempre la fila que SÍ tiene Código Ítem lleno (no EMPTY)
        if (!existingCode && code) {
          if (existing.id) ribiIdsToDelete.push(existing.id);
          ribiByPedidoDesc.set(groupKey, r);
        } else {
          if (r.id) ribiIdsToDelete.push(r.id);
        }
      }
    }

    // Segunda pasada por (PedidoSIN + Código Ítem) para asegurar unicidad también por código
    const ribiByPedidoCode = new Map();
    for (const [groupKey, r] of ribiByPedidoDesc.entries()) {
      const pSin = cleanErpCode(r['PedidoSIN']);
      const descNorm = normalizeProductName(r['Descripción']);
      let code = cleanErpCode(r['Código Ítem']);

      // Si el registro sobreviviente tenía Código Ítem vacío pero existe en prodToCodptMap, enriquecerlo
      if (!code && pSin && descNorm && prodToCodptMap.has(`${pSin}__${descNorm}`)) {
        code = prodToCodptMap.get(`${pSin}__${descNorm}`);
        if (r.id && code) {
          ribiToUpdateCode.push({ id: r.id, code });
        }
      }

      if (pSin && code) {
        const codeKey = `${pSin}__CODE__${code}`;
        if (ribiByPedidoCode.has(codeKey)) {
          const prev = ribiByPedidoCode.get(codeKey);
          if (prev.id !== r.id && r.id) {
            ribiIdsToDelete.push(r.id);
            ribiByPedidoDesc.delete(groupKey);
          }
        } else {
          ribiByPedidoCode.set(codeKey, r);
        }
      }
    }

    ribisoftDuplicatesRemoved = await deleteIdsInBatches('ribisoft_pedidos', ribiIdsToDelete);

    for (let i = 0; i < ribiToUpdateCode.length; i += 25) {
      const slice = ribiToUpdateCode.slice(i, i + 25);
      await Promise.all(
        slice.map(item =>
          supabase.from('ribisoft_pedidos').update({ 'Código Ítem': item.code }).eq('id', item.id)
        )
      );
      codesEnriched += slice.length;
    }
  } catch (err) {
    console.warn('Aviso depurando ribisoft_pedidos:', err.message);
  }

  if (onProgress) onProgress(70);

  // 3. Inspeccionar y depurar `produccion_pedidos` (conservando siempre el producto con avances en planta)
  let produccionDuplicatesRemoved = 0;

  try {
    const allPlanta = await fetchAllTableRows(
      'produccion_pedidos',
      'id, pedido_num, codigo_item, data_completa'
    );

    const plantaGroups = new Map();
    const plantaIdsToDelete = [];
    const plantaToUpdate = [];

    const getPlantaProgressScore = (row) => {
      const d = row?.data_completa || {};
      let score = 0;
      if (d.estadoInterno === 'DESPACHADO' || d.isTerminado) score += 100;
      if (d.areaActual && d.areaActual !== 'Diseño') score += 50;
      if (Array.isArray(d.bitacoraTurnos) && d.bitacoraTurnos.length > 0) score += 30 + d.bitacoraTurnos.length;
      if (Array.isArray(d.bitacoraCalidad) && d.bitacoraCalidad.length > 0) score += 20 + d.bitacoraCalidad.length;
      if (Array.isArray(d.historial) && d.historial.length > 1) score += 10 + d.historial.length;
      const code = cleanErpCode(row?.codigo_item ?? d.codArticulo ?? d.codigo_item);
      if (code) score += 5;
      return score;
    };

    for (const r of allPlanta) {
      const d = r?.data_completa || {};
      const hist = Array.isArray(d.historial) ? d.historial : [];
      const firstHist = hist[0] || {};
      const isAutoErpDump =
        (firstHist.entrega === 'ERP RIBISOFT' ||
          firstHist.accion === 'Importación ERP Ribisoft (Ingreso Inicial)') &&
        hist.length <= 1 &&
        (!Array.isArray(d.bitacoraTurnos) || d.bitacoraTurnos.length === 0) &&
        (!Array.isArray(d.bitacoraCalidad) || d.bitacoraCalidad.length === 0) &&
        (!d.areaActual || d.areaActual === 'Diseño') &&
        d.estadoInterno !== 'DESPACHADO' &&
        !d.isTerminado;

      // Si fue volcado automáticamente por el Excel sin haber sido ingresado a planta por el usuario, eliminarlo de produccion_pedidos
      if (isAutoErpDump) {
        if (r.id) plantaIdsToDelete.push(r.id);
        continue;
      }

      const pSin = cleanErpCode(d.pedidoNum ?? r.pedido_num);
      const descNorm = normalizeProductName(d.nombre ?? d.descripcion);
      const code = cleanErpCode(r.codigo_item ?? d.codArticulo ?? d.codigo_item);

      if (!pSin) continue;

      const groupKey = `${pSin}__${descNorm || code || r.id}`;
      const existing = plantaGroups.get(groupKey);

      if (!existing) {
        plantaGroups.set(groupKey, r);
      } else {
        const existingScore = getPlantaProgressScore(existing);
        const candidateScore = getPlantaProgressScore(r);

        if (candidateScore > existingScore) {
          // Si el anterior tenía código y el ganador no, heredar el código
          const prevCode = cleanErpCode(existing.codigo_item ?? existing?.data_completa?.codArticulo);
          if (prevCode && !code) {
            r.codigo_item = prevCode;
            r.data_completa = { ...(r.data_completa || {}), codArticulo: prevCode, codigo_item: prevCode };
            plantaToUpdate.push({ id: r.id, codigo_item: prevCode, data_completa: r.data_completa });
          }
          if (existing.id) plantaIdsToDelete.push(existing.id);
          plantaGroups.set(groupKey, r);
        } else {
          // Si el candidato tenía código y el ganador existente no, heredar el código al ganador
          const existingCode = cleanErpCode(existing.codigo_item ?? existing?.data_completa?.codArticulo);
          if (code && !existingCode) {
            existing.codigo_item = code;
            existing.data_completa = { ...(existing.data_completa || {}), codArticulo: code, codigo_item: code };
            plantaToUpdate.push({ id: existing.id, codigo_item: code, data_completa: existing.data_completa });
          }
          if (r.id) plantaIdsToDelete.push(r.id);
        }
      }
    }

    // También enriquecer desde prodToCodptMap los sobrevivientes que aún no tengan código
    for (const r of plantaGroups.values()) {
      const d = r?.data_completa || {};
      const pSin = cleanErpCode(d.pedidoNum ?? r.pedido_num);
      const descNorm = normalizeProductName(d.nombre ?? d.descripcion);
      const currentCode = cleanErpCode(r.codigo_item ?? d.codArticulo ?? d.codigo_item);
      const matchedCodpt = pSin && descNorm ? prodToCodptMap.get(`${pSin}__${descNorm}`) : null;

      if (matchedCodpt && currentCode !== matchedCodpt) {
        const updatedData = { ...d, codArticulo: matchedCodpt, codigo_item: matchedCodpt };
        plantaToUpdate.push({ id: r.id, codigo_item: matchedCodpt, data_completa: updatedData });
      }
    }

    produccionDuplicatesRemoved = await deleteIdsInBatches('produccion_pedidos', plantaIdsToDelete);

    for (let i = 0; i < plantaToUpdate.length; i += 25) {
      const slice = plantaToUpdate.slice(i, i + 25);
      await Promise.all(
        slice.map(item =>
          supabase
            .from('produccion_pedidos')
            .update({ codigo_item: item.codigo_item, data_completa: item.data_completa })
            .eq('id', item.id)
        )
      );
      codesEnriched += slice.length;
    }
  } catch (err) {
    console.warn('Aviso depurando produccion_pedidos:', err.message);
  }

  await localforage.removeItem('cdi_mrp_processed_cache_v2');
  await localforage.removeItem('cdi_mrp_processed_cache_v3');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cdi-erp-synced'));
  }
  if (onProgress) onProgress(100);

  return {
    ribisoftDuplicatesRemoved,
    produccionDuplicatesRemoved,
    requerimientosDuplicatesRemoved,
    codesEnriched
  };
};

/**
 * A) Importar MATERIALES REQUERIDOS PARA PEDIDOS.xls en `requerimientos_pedido`
 * y actualizar `existencia` y `ubicacion` en `inventario` cuando coincida `idreferencia`.
 * - SOLO inserta los requerimientos que NO estén cargados aún.
 * - Si un requerimiento ya existe y cambió su cantidad entregada/pendiente/existencia, actualiza esa fila sin duplicar.
 */
export const importMaterialesRequeridosRows = async (rows, onProgress) => {
  const uniqueExcelReqsMap = new Map();
  const inventoryUpdatesMap = new Map();
  const prodToCodptMap = new Map();

  for (const row of rows) {
    const pedidoSinRaw = row['pedido_sin'] ?? row['pedidosin'] ?? row['PedidoSIN'];
    const pedido_sin = pedidoSinRaw !== undefined && pedidoSinRaw !== null && String(pedidoSinRaw).trim() !== ''
      ? cleanErpCode(pedidoSinRaw)
      : null;

    if (!pedido_sin) continue;

    // CRÍTICO: En Excel codpt viene como float 33000070.0 -> limpiar obligatoriamente
    const rawCodPt = row['codpt'];
    let codpt = null;
    if (rawCodPt !== undefined && rawCodPt !== null && String(rawCodPt).trim() !== '') {
      const numCod = Number(rawCodPt);
      const cleaned = !Number.isNaN(numCod) && Number.isFinite(numCod)
        ? String(Math.trunc(numCod)).trim()
        : String(rawCodPt).replace(/\.0+$/, '').trim();
      if (cleaned && cleaned !== 'NaN' && cleaned !== '0') {
        codpt = cleaned;
      }
    }

    const rawIdRef = row['idreferencia'] ?? row['Id Referencia'] ?? row['id_referencia'];
    const idreferencia = rawIdRef !== undefined && rawIdRef !== null && String(rawIdRef).trim() !== ''
      ? cleanErpCode(rawIdRef)
      : null;

    if (!idreferencia) continue;

    const numero_rq = row['numero'] !== undefined && row['numero'] !== null && String(row['numero']).trim() !== ''
      ? String(row['numero']).trim()
      : (row['numero_rq'] ? String(row['numero_rq']).trim() : null);

    const pedido_cot = row['pedido'] !== undefined && row['pedido'] !== null && String(row['pedido']).trim() !== ''
      ? String(row['pedido']).replace(/\.0+$/, '').trim()
      : (row['pedido_cot'] ? String(row['pedido_cot']).replace(/\.0+$/, '').trim() : null);

    const producto = row['producto'] !== undefined && row['producto'] !== null && String(row['producto']).trim() !== ''
      ? String(row['producto']).trim()
      : null;

    if (codpt && producto) {
      prodToCodptMap.set(`${pedido_sin}__${normalizeProductName(producto)}`, codpt);
    }

    const referencia = row['referencia'] !== undefined && row['referencia'] !== null
      ? String(row['referencia']).trim()
      : (row['Descripcion'] ? String(row['Descripcion']).trim() : '');

    const idunidad = row['idunidad'] !== undefined && row['idunidad'] !== null
      ? String(row['idunidad']).trim()
      : (row['Id Unidad'] ? String(row['Id Unidad']).trim() : null);

    // Convertir fecha serial de Excel (ej: 46120.371527777774) a ISO 8601 para TIMESTAMPTZ
    const fecha_solicitud = cleanExcelDate(row['Fecha Solicitud'] ?? row['fecha_solicitud']);

    const pedida_reser = toSafeNumber(row['pedida(reser)'] ?? row['pedida_reser'] ?? row['Cantidad']);
    const cant_oc = toSafeNumber(row['cant_oc'] ?? row['Cant.OC']);
    const entregada = toSafeNumber(row['entregada']);
    const pendiente = row['pendiente'] !== undefined && row['pendiente'] !== null && row['pendiente'] !== ''
      ? toSafeNumber(row['pendiente'])
      : Math.max(0, pedida_reser - entregada);
    const existencia = toSafeNumber(row['existencia']);

    const rawUbic = row['Ubicación'] ?? row['Ubicacion'] ?? row['ubicacion'];
    const ubicacion = rawUbic !== undefined && rawUbic !== null && String(rawUbic).trim() !== ''
      ? String(rawUbic).trim()
      : null;

    const reqKey = `${pedido_sin}__${codpt || ''}__${normalizeProductName(producto)}__${idreferencia}__${String(numero_rq || '').trim().toUpperCase()}`;

    uniqueExcelReqsMap.set(reqKey, {
      numero_rq,
      pedido_cot,
      pedido_sin,
      pedidosin: pedido_sin,
      codpt,
      producto,
      idreferencia,
      "Id Referencia": idreferencia,
      referencia,
      "Descripcion": referencia,
      idunidad,
      fecha_solicitud,
      pedida_reser,
      "Cantidad": pedida_reser,
      cant_oc,
      "Cant.OC": cant_oc,
      entregada,
      pendiente,
      existencia,
      ubicacion
    });

    const prevInv = inventoryUpdatesMap.get(idreferencia);
    inventoryUpdatesMap.set(idreferencia, {
      idreferencia,
      referencia: referencia || prevInv?.referencia || '',
      idunidad: idunidad || prevInv?.idunidad || '',
      existencia,
      ubicacion: ubicacion || prevInv?.ubicacion || ''
    });
  }

  if (onProgress) onProgress(10);

  // Consultar qué requerimientos ya existen en la BD para NO duplicarlos y solo insertar los nuevos
  const existingReqs = await fetchAllTableRows(
    'requerimientos_pedido',
    'id, numero_rq, pedido_sin, pedidosin, codpt, producto, idreferencia, referencia, pedida_reser, cant_oc, entregada, pendiente, existencia, ubicacion'
  );

  const existingReqMap = new Map();
  const duplicateReqIdsToDelete = [];

  for (const r of existingReqs) {
    const pSin = cleanErpCode(r.pedido_sin ?? r.pedidosin);
    const idRef = cleanErpCode(r.idreferencia);
    const codpt = cleanErpCode(r.codpt);
    const prodNorm = normalizeProductName(r.producto);
    const rqNum = String(r.numero_rq || '').trim().toUpperCase();

    if (!pSin || !idRef || !r.pedido_sin || !r.idreferencia) {
      if (r.id) duplicateReqIdsToDelete.push(r.id);
      continue;
    }

    const key = `${pSin}__${codpt || ''}__${prodNorm}__${idRef}__${rqNum}`;
    if (existingReqMap.has(key)) {
      if (r.id) duplicateReqIdsToDelete.push(r.id);
    } else {
      existingReqMap.set(key, r);
    }
  }

  if (duplicateReqIdsToDelete.length > 0) {
    await deleteIdsInBatches('requerimientos_pedido', duplicateReqIdsToDelete);
  }

  const rowsToInsert = [];
  const rowsToUpdate = [];
  let skippedExisting = 0;

  for (const [reqKey, newRow] of uniqueExcelReqsMap.entries()) {
    const existing = existingReqMap.get(reqKey);
    if (!existing) {
      rowsToInsert.push(newRow);
    } else {
      // Si ya existe, NO se vuelve a insertar; solo se actualiza si cambió algún saldo o si le faltaba referencia/codpt
      const changed =
        toSafeNumber(existing.entregada) !== newRow.entregada ||
        toSafeNumber(existing.pendiente) !== newRow.pendiente ||
        toSafeNumber(existing.existencia) !== newRow.existencia ||
        toSafeNumber(existing.cant_oc) !== newRow.cant_oc ||
        (!existing.referencia && newRow.referencia) ||
        (!existing.codpt && newRow.codpt);

      if (changed && existing.id) {
        rowsToUpdate.push({ id: existing.id, payload: newRow });
      } else {
        skippedExisting++;
      }
    }
  }

  if (onProgress) onProgress(20);

  // Insertar únicamente las filas nuevas que no estaban en `requerimientos_pedido`
  const insertedCount = await adaptiveBatchWrite('requerimientos_pedido', rowsToInsert, {
    mode: 'insert',
    onProgress,
    progressStart: 20,
    progressEnd: 65,
    chunkSize: 800
  });

  // Actualizar en lote las filas existentes cuyos saldos de almacén hayan cambiado
  for (let i = 0; i < rowsToUpdate.length; i += 25) {
    const slice = rowsToUpdate.slice(i, i + 25);
    await Promise.all(
      slice.map(item =>
        supabase.from('requerimientos_pedido').update(item.payload).eq('id', item.id)
      )
    );
  }

  // Actualizar `existencia` y `ubicacion` en `inventario` cuando coincida `idreferencia` (en lotes rápidos)
  const invUpdates = Array.from(inventoryUpdatesMap.values());
  let updatedInvCount = 0;
  const concurrency = 25;

  for (let i = 0; i < invUpdates.length; i += concurrency) {
    const slice = invUpdates.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async (upd) => {
        const updatePayload = {
          existencia: upd.existencia,
          "Saldo": upd.existencia
        };
        if (upd.ubicacion) {
          updatePayload.ubicacion = upd.ubicacion;
          updatePayload["Ubicacion"] = upd.ubicacion;
        }
        const { error } = await supabase
          .from('inventario')
          .update(updatePayload)
          .eq('Id Referencia', upd.idreferencia);
        return !error;
      })
    );
    updatedInvCount += results.filter(Boolean).length;

    if (onProgress && invUpdates.length > 0) {
      const ratio = Math.min(1, (i + slice.length) / invUpdates.length);
      onProgress(Math.round(65 + ratio * 20));
    }
  }

  // Enriquecer códigos y limpiar duplicados con código vacío en `ribisoft_pedidos` y `produccion_pedidos`
  if (prodToCodptMap.size > 0) {
    await deduplicateErpTables();
  }

  await localforage.removeItem('cdi_mrp_processed_cache_v2');
  await localforage.removeItem('cdi_mrp_processed_cache_v3');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cdi-erp-synced'));
  }
  if (onProgress) onProgress(100);
  return {
    insertedCount,
    updatedReqCount: rowsToUpdate.length,
    skippedExisting,
    updatedInvCount
  };
};

/**
 * B) Importar `lista de pedidos de produccion.xls` en `ribisoft_pedidos` y `produccion_pedidos`.
 * - Depura automáticamente cualquier duplicado existente en `ribisoft_pedidos` (ej. filas viejas con Código Ítem vacío).
 * - SOLO inserta lo que NO esté cargado aún ni en `ribisoft_pedidos` ni en `produccion_pedidos`.
 */
export const importPedidosProduccionRows = async (rows, onProgress) => {
  const validRows = rows.filter(row => {
    const anulado = isTruthyExcelFlag(row['Anulado'] ?? row['anulado']);
    const descartado = isTruthyExcelFlag(row['Descartado'] ?? row['descartado']);
    return !anulado && !descartado;
  });

  // Consultar mapa (pedido_sin + producto) -> codpt desde `requerimientos_pedido` para cruzar los códigos 3300xxxx
  const prodToCodptMap = new Map();
  try {
    const reqsWithCode = await fetchAllTableRows('requerimientos_pedido', 'pedido_sin, codpt, producto');
    for (const r of reqsWithCode) {
      const pSin = cleanErpCode(r.pedido_sin);
      const codpt = cleanErpCode(r.codpt);
      const prod = normalizeProductName(r.producto);
      if (pSin && codpt && prod) {
        prodToCodptMap.set(`${pSin}__${prod}`, codpt);
      }
    }
  } catch (_) {}

  // Deduplicar las propias filas del archivo Excel en memoria para no procesar dos veces el mismo ítem
  const uniqueExcelItemsMap = new Map();

  for (const row of validRows) {
    const rawPedido = row['PedidoSIN'] ?? row['pedido_sin'] ?? row['pedidosin'] ?? row['Pedido'];
    const pedido_sin = cleanErpCode(rawPedido);
    if (!pedido_sin) continue;

    const codigo_item = extractCodigoItem(row, prodToCodptMap, pedido_sin);
    const descripcion = String(row['Descripción'] ?? row['Descripcion'] ?? row['descripcion'] ?? row['Producto'] ?? row['producto'] ?? '').trim();
    const cliente = String(row['Cliente'] ?? row['cliente'] ?? row['Nombre Proyecto'] ?? row['nombre_proyecto'] ?? '').trim();
    const nombre_proyecto = String(row['Nombre Proyecto'] ?? row['nombre_proyecto'] ?? row['Proyecto'] ?? '').trim();
    const programador = String(row['Programador'] ?? row['programador'] ?? '').trim();
    const cantidad = toSafeNumber(row['Cantidad'] ?? row['cantidad'] ?? 1) || 1;
    const estado = String(row['Estado'] ?? row['estado'] ?? '').trim();

    const dim_1 = row['Dim.1'] ?? row['dim_1'] ?? row['Dim 1'] ?? row['Dim1'] ?? row['Dim_1'] ?? null;
    const dim_2 = row['Dim.2'] ?? row['dim_2'] ?? row['Dim 2'] ?? row['Dim2'] ?? row['Dim_2'] ?? null;
    const dim_3 = row['Dim.3'] ?? row['dim_3'] ?? row['Dim 3'] ?? row['Dim3'] ?? row['Dim_3'] ?? null;

    const acabado_1 = row['Acabado1'] ?? row['acabado_1'] ?? row['Acabado 1'] ?? row['Acabado_1'] ?? null;
    const acabado_2 = row['Acabado2'] ?? row['acabado_2'] ?? row['Acabado 2'] ?? row['Acabado_2'] ?? null;
    const acabado_3 = row['Acabado3'] ?? row['acabado_3'] ?? row['Acabado 3'] ?? row['Acabado_3'] ?? null;

    const caracteristicas = row['Características'] ?? row['Caracteristicas'] ?? row['caracteristicas'] ?? null;
    const categoria = row['Categoria'] ?? row['Categoría'] ?? row['categoria'] ?? null;
    const notas = row['Notas'] ?? row['notas'] ?? null;
    const observaciones_erp = row['Observaciones'] ?? row['observaciones_erp'] ?? row['Observaciones ERP'] ?? row['observaciones'] ?? null;

    // Convertir números seriales de fecha de Excel a ISO 8601 TIMESTAMPTZ
    const fecha_asigna = cleanExcelDate(row['Fecha asigna'] ?? row['Fecha Asigna'] ?? row['fecha_asigna']);
    const fecha_genera_ped = cleanExcelDate(row['Fecha Genera Ped.'] ?? row['Fecha Genera Ped'] ?? row['fecha_genera_ped'] ?? row['Fecha Genera']);
    const fecha_entrega = cleanExcelDate(row['Fecha Entrega'] ?? row['fecha_entrega']);

    const normDesc = normalizeProductName(descripcion);
    const dedupKey = `${pedido_sin}__${normDesc || codigo_item || ''}`;

    if (!uniqueExcelItemsMap.has(dedupKey) || (codigo_item && !uniqueExcelItemsMap.get(dedupKey).codigo_item)) {
      uniqueExcelItemsMap.set(dedupKey, {
        pedido_sin,
        codigo_item: codigo_item || '',
        descripcion,
        normDesc,
        cliente: cliente || nombre_proyecto || 'N/A',
        rawCliente: cliente,
        nombre_proyecto,
        programador,
        cantidad,
        estado,
        fecha_entrega,
        dim_1: dim_1 !== null && dim_1 !== '' ? String(dim_1).trim() : null,
        dim_2: dim_2 !== null && dim_2 !== '' ? String(dim_2).trim() : null,
        dim_3: dim_3 !== null && dim_3 !== '' ? String(dim_3).trim() : null,
        acabado_1: acabado_1 !== null && acabado_1 !== '' ? String(acabado_1).trim() : null,
        acabado_2: acabado_2 !== null && acabado_2 !== '' ? String(acabado_2).trim() : null,
        acabado_3: acabado_3 !== null && acabado_3 !== '' ? String(acabado_3).trim() : null,
        caracteristicas: caracteristicas !== null && caracteristicas !== '' ? String(caracteristicas).trim() : null,
        categoria: categoria !== null && categoria !== '' ? String(categoria).trim() : null,
        notas: notas !== null && notas !== '' ? String(notas).trim() : null,
        observaciones_erp: observaciones_erp !== null && observaciones_erp !== '' ? String(observaciones_erp).trim() : null,
        fecha_asigna,
        fecha_genera_ped
      });
    }
  }

  const uniqueCandidates = Array.from(uniqueExcelItemsMap.values());

  // 1. Consultar qué existe actualmente en `ribisoft_pedidos`, limpiar duplicados existentes y SOLO insertar lo nuevo
  const existingRibisoftSet = new Set();
  const ribiToUpdateCode = [];
  let ribisoftDuplicatesCleaned = 0;

  try {
    const existingRibiRows = await fetchAllTableRows(
      'ribisoft_pedidos',
      'id, "PedidoSIN", "Código Ítem", "Descripción"'
    );

    const seenRibiByDesc = new Map();
    const duplicateRibiIds = [];

    for (const r of existingRibiRows) {
      const pSin = cleanErpCode(r['PedidoSIN']);
      const cArt = cleanErpCode(r['Código Ítem']);
      const pName = normalizeProductName(r['Descripción']);
      if (!pSin) {
        if (r.id) duplicateRibiIds.push(r.id);
        continue;
      }

      const descKey = `${pSin}__NAME__${pName || cArt || ''}`;
      if (!seenRibiByDesc.has(descKey)) {
        seenRibiByDesc.set(descKey, r);
      } else {
        const prev = seenRibiByDesc.get(descKey);
        const prevCode = cleanErpCode(prev['Código Ítem']);
        // Conservar el registro que SÍ tenga Código Ítem y borrar el que tenga EMPTY
        if (!prevCode && cArt) {
          if (prev.id) duplicateRibiIds.push(prev.id);
          seenRibiByDesc.set(descKey, r);
        } else {
          if (r.id) duplicateRibiIds.push(r.id);
        }
      }
    }

    if (duplicateRibiIds.length > 0) {
      ribisoftDuplicatesCleaned = await deleteIdsInBatches('ribisoft_pedidos', duplicateRibiIds);
    }

    for (const r of seenRibiByDesc.values()) {
      const pSin = cleanErpCode(r['PedidoSIN']);
      const cArt = cleanErpCode(r['Código Ítem']);
      const pName = normalizeProductName(r['Descripción']);
      if (pSin && cArt) existingRibisoftSet.add(`${pSin}_${cArt}`);
      if (pSin && pName) existingRibisoftSet.add(`${pSin}__NAME__${pName}`);

      // Si el registro existente en ribisoft_pedidos no tenía Código Ítem pero ahora sí lo tenemos, actualizarlo sin duplicar
      if (!cArt && pSin && pName) {
        const candidate = uniqueExcelItemsMap.get(`${pSin}__${pName}`);
        const newCode = candidate?.codigo_item || prodToCodptMap.get(`${pSin}__${pName}`);
        if (newCode && r.id) {
          ribiToUpdateCode.push({ id: r.id, code: newCode });
          existingRibisoftSet.add(`${pSin}_${newCode}`);
        }
      }
    }

    for (let i = 0; i < ribiToUpdateCode.length; i += 25) {
      const slice = ribiToUpdateCode.slice(i, i + 25);
      await Promise.all(
        slice.map(item =>
          supabase.from('ribisoft_pedidos').update({ 'Código Ítem': item.code }).eq('id', item.id)
        )
      );
    }
  } catch (err) {
    console.warn('Aviso verificando existentes en ribisoft_pedidos:', err.message);
  }

  // Filtrar `newRibisoftPayload`: SOLO lo que NO esté cargado en `ribisoft_pedidos`
  const newRibisoftPayload = [];
  for (const item of uniqueCandidates) {
    const codeKey = item.codigo_item ? `${item.pedido_sin}_${item.codigo_item}` : null;
    const nameKey = item.normDesc ? `${item.pedido_sin}__NAME__${item.normDesc}` : null;

    if ((codeKey && existingRibisoftSet.has(codeKey)) || (nameKey && existingRibisoftSet.has(nameKey))) {
      continue; // Ya existe en ribisoft_pedidos: NO volver a insertar
    }
    if (codeKey) existingRibisoftSet.add(codeKey);
    if (nameKey) existingRibisoftSet.add(nameKey);

    newRibisoftPayload.push({
      "PedidoSIN": item.pedido_sin,
      "Código Ítem": item.codigo_item || '',
      "Descripción": item.descripcion,
      "Cliente": item.rawCliente,
      "Nombre Proyecto": item.nombre_proyecto,
      "Estado": item.estado,
      "Programador": item.programador,
      "Cantidad": item.cantidad,
      dim_1: item.dim_1,
      dim_2: item.dim_2,
      dim_3: item.dim_3,
      acabado_1: item.acabado_1,
      acabado_2: item.acabado_2,
      acabado_3: item.acabado_3,
      caracteristicas: item.caracteristicas,
      programador: item.programador || null,
      categoria: item.categoria,
      notas: item.notas,
      observaciones_erp: item.observaciones_erp,
      fecha_asigna: item.fecha_asigna,
      fecha_genera_ped: item.fecha_genera_ped
    });
  }

  if (newRibisoftPayload.length > 0) {
    try {
      await adaptiveBatchWrite('ribisoft_pedidos', newRibisoftPayload, {
        mode: 'insert',
        onProgress,
        progressStart: 0,
        progressEnd: 50,
        chunkSize: 800
      });
    } catch (err) {
      console.warn('Aviso insertando en ribisoft_pedidos:', err.message);
    }
  } else if (onProgress) {
    onProgress(50);
  }

  // 2. En `produccion_pedidos` SOLO deben existir los productos ingresados explícitamente a planta por los usuarios.
  //    NO se vuelca el Excel a planta: solo se enriquecen los códigos/metadatos de los productos que YA están en planta
  //    y se limpian los que se hubieran volcado automáticamente sin ingreso manual.
  const existingPlanta = await fetchAllTableRows(
    'produccion_pedidos',
    'id, pedido_num, codigo_item, data_completa'
  );

  const plantaToEnrich = [];
  const autoDumpIdsToRemove = [];

  (existingPlanta || []).forEach(r => {
    const d = r?.data_completa || {};
    const hist = Array.isArray(d.historial) ? d.historial : [];
    const firstHist = hist[0] || {};
    const isAutoErpDump =
      (firstHist.entrega === 'ERP RIBISOFT' ||
        firstHist.accion === 'Importación ERP Ribisoft (Ingreso Inicial)') &&
      hist.length <= 1 &&
      (!Array.isArray(d.bitacoraTurnos) || d.bitacoraTurnos.length === 0) &&
      (!Array.isArray(d.bitacoraCalidad) || d.bitacoraCalidad.length === 0) &&
      (!d.areaActual || d.areaActual === 'Diseño') &&
      d.estadoInterno !== 'DESPACHADO' &&
      !d.isTerminado;

    if (isAutoErpDump) {
      if (r.id) autoDumpIdsToRemove.push(r.id);
      return;
    }

    const pNum = cleanErpCode(d.pedidoNum ?? r?.pedido_num);
    const cArt = cleanErpCode(r?.codigo_item ?? d.codArticulo ?? d.codigo_item);
    const pName = normalizeProductName(d.nombre ?? d.descripcion);

    if (!cArt && pNum && pName) {
      const candidate = uniqueExcelItemsMap.get(`${pNum}__${pName}`);
      const newCode = candidate?.codigo_item || prodToCodptMap.get(`${pNum}__${pName}`);
      if (newCode && r.id) {
        const updatedDataCompleta = {
          ...d,
          codArticulo: newCode,
          codigo_item: newCode
        };
        plantaToEnrich.push({ id: r.id, codigo_item: newCode, data_completa: updatedDataCompleta });
      }
    }
  });

  if (autoDumpIdsToRemove.length > 0) {
    await deleteIdsInBatches('produccion_pedidos', autoDumpIdsToRemove);
  }

  for (let i = 0; i < plantaToEnrich.length; i += 25) {
    const slice = plantaToEnrich.slice(i, i + 25);
    await Promise.all(
      slice.map(item =>
        supabase
          .from('produccion_pedidos')
          .update({ codigo_item: item.codigo_item, data_completa: item.data_completa })
          .eq('id', item.id)
      )
    );
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cdi-erp-synced'));
  }
  if (onProgress) onProgress(100);

  return {
    ribisoftInserted: newRibisoftPayload.length,
    ribisoftDuplicatesCleaned,
    plantaEnriched: plantaToEnrich.length,
    plantaPurgedAutoDumps: autoDumpIdsToRemove.length,
    skippedExisting: uniqueCandidates.length - newRibisoftPayload.length
  };
};

/**
 * C) Importar `ConsultaInventario MUESTRA 3.xlsx` en `inventario`.
 * - Mapea Id Referencia (sin .0), Referencia, Grupo, Subgrupo, Linea, Ubicacion, Id Unidad, Embalaje.
 * - Mantiene el filtro por defecto para priorizar 'Materias Primas e insumos' y 'Herramientas'.
 * - Consulta las referencias existentes y SOLO inserta las referencias que NO estaban cargadas.
 */
export const importConsultaInventarioRows = async (rows, onProgress, filterGroups = true) => {
  const ALLOWED_GROUPS = ['MATERIAS PRIMAS', 'HERRAMIENTAS'];

  const filteredRows = filterGroups
    ? rows.filter(row => {
        const grupo = String(row['Grupo'] ?? row['grupo'] ?? '').trim().toUpperCase();
        if (!grupo) return true;
        return ALLOWED_GROUPS.some(g => grupo.includes(g));
      })
    : rows;

  const uniqueInventarioMap = new Map();

  for (const row of filteredRows) {
    const rawIdRef = row['Id Referencia'] ?? row['idreferencia'] ?? row['id_referencia'];
    const idreferencia = rawIdRef !== undefined && rawIdRef !== null && String(rawIdRef).trim() !== ''
      ? cleanErpCode(rawIdRef)
      : null;

    if (!idreferencia) continue;

    const referencia = String(row['Referencia'] ?? row['referencia'] ?? '').trim();
    const grupo = String(row['Grupo'] ?? row['grupo'] ?? '').trim();
    const subgrupo = String(row['Subgrupo'] ?? row['subgrupo'] ?? '').trim();
    const linea = String(row['Linea'] ?? row['Línea'] ?? row['linea'] ?? '').trim();
    const ubicacion = String(row['Ubicacion'] ?? row['Ubicación'] ?? row['ubicacion'] ?? '').trim();
    const idunidad = String(row['Id Unidad'] ?? row['idunidad'] ?? '').trim();
    const embalaje = String(row['Embalaje'] ?? row['embalaje'] ?? '').trim();

    // Columnas exactas verificadas en `inventario` de Supabase
    const itemPayload = {
      "Id Referencia": idreferencia,
      "Referencia": referencia,
      referencia,
      "Grupo": grupo,
      grupo,
      "Subgrupo": subgrupo,
      subgrupo,
      "Linea": linea,
      linea,
      "Ubicacion": ubicacion,
      ubicacion,
      "Id Unidad": idunidad,
      "Embalaje": embalaje,
      embalaje
    };

    // Solo incluir Saldo/existencia si la fila del Excel trae explícitamente esa columna con valor
    const rawExist = row['Existencia'] ?? row['existencia'] ?? row['Saldo'];
    if (rawExist !== undefined && rawExist !== null && String(rawExist).trim() !== '') {
      const existVal = toSafeNumber(rawExist);
      itemPayload["Saldo"] = existVal;
      itemPayload.existencia = existVal;
    }

    uniqueInventarioMap.set(idreferencia, itemPayload);
  }

  // Consultar qué referencias ya existen en `inventario` para insertar únicamente las nuevas
  const existingInvRows = await fetchAllTableRows('inventario', '"Id Referencia"');
  const existingInvSet = new Set(
    (existingInvRows || [])
      .map(r => cleanErpCode(r['Id Referencia']))
      .filter(Boolean)
  );

  const newInventarioRows = [];
  let skippedExisting = 0;

  for (const [idRef, payload] of uniqueInventarioMap.entries()) {
    if (existingInvSet.has(idRef)) {
      skippedExisting++;
    } else {
      newInventarioRows.push(payload);
    }
  }

  const importedCount = newInventarioRows.length > 0
    ? await adaptiveBatchWrite('inventario', newInventarioRows, {
        mode: 'upsert',
        onConflict: 'Id Referencia',
        onProgress,
        progressStart: 0,
        progressEnd: 100,
        chunkSize: 800
      })
    : 0;

  await localforage.removeItem('cdi_mrp_processed_cache_v2');
  await localforage.removeItem('cdi_mrp_processed_cache_v3');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cdi-erp-synced'));
  }
  if (onProgress) onProgress(100);

  return { importedCount, skippedExisting };
};

/**
 * Lee un archivo Excel (.xls / .xlsx) desde el navegador y detecta automáticamente
 * a cuál de las 3 tablas ERP de Ribisoft corresponde según sus cabeceras.
 */
export const importRibisoftExcelFile = async (file, onProgress) => {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (!rows || rows.length === 0) {
    throw new Error('El archivo Excel está vacío o no tiene filas válidas.');
  }

  const sampleKeys = Object.keys(rows[0]).map(k => k.toLowerCase().trim());

  // Detectar si es MATERIALES REQUERIDOS PARA PEDIDOS.xls
  if (
    sampleKeys.includes('pedida(reser)') ||
    sampleKeys.includes('pedida_reser') ||
    (sampleKeys.includes('codpt') && sampleKeys.includes('idreferencia'))
  ) {
    const res = await importMaterialesRequeridosRows(rows, onProgress);
    return { type: 'requerimientos_pedido', ...res };
  }

  // Detectar si es ConsultaInventario MUESTRA 3.xlsx
  if (
    (sampleKeys.includes('grupo') && sampleKeys.includes('subgrupo')) ||
    sampleKeys.includes('embalaje')
  ) {
    const res = await importConsultaInventarioRows(rows, onProgress, true);
    return { type: 'inventario', ...res };
  }

  // Por defecto: lista de pedidos de produccion.xls
  const res = await importPedidosProduccionRows(rows, onProgress);
  return { type: 'produccion_pedidos', ...res };
};
