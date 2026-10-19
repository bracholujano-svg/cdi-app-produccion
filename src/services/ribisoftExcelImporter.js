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
 * A) Importar MATERIALES REQUERIDOS PARA PEDIDOS.xls en `requerimientos_pedido`
 * y actualizar `existencia` y `ubicacion` en `inventario` cuando coincida `idreferencia`.
 */
export const importMaterialesRequeridosRows = async (rows, onProgress) => {
  const mappedRows = [];
  const inventoryUpdatesMap = new Map();
  const uniquePedidosSet = new Set();
  const prodToCodptMap = new Map();

  for (const row of rows) {
    const pedidoSinRaw = row['pedido_sin'] ?? row['pedidosin'] ?? row['PedidoSIN'];
    const pedido_sin = pedidoSinRaw !== undefined && pedidoSinRaw !== null && String(pedidoSinRaw).trim() !== ''
      ? cleanErpCode(pedidoSinRaw)
      : null;

    if (!pedido_sin) continue;
    uniquePedidosSet.add(pedido_sin);

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

    // Columnas exactas verificadas en la tabla `requerimientos_pedido` de Supabase
    mappedRows.push({
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

  if (onProgress) onProgress(5);

  // Limpiar requerimientos previos de los pedidos que vienen en este archivo para evitar duplicados al re-sincronizar
  const uniquePedidos = Array.from(uniquePedidosSet);
  for (let i = 0; i < uniquePedidos.length; i += 200) {
    const batchPedidos = uniquePedidos.slice(i, i + 200);
    await supabase.from('requerimientos_pedido').delete().in('pedido_sin', batchPedidos);
    await supabase.from('requerimientos_pedido').delete().in('pedidosin', batchPedidos);
  }

  if (onProgress) onProgress(10);

  // Insertar todas las filas en `requerimientos_pedido`
  const insertedCount = await adaptiveBatchWrite('requerimientos_pedido', mappedRows, {
    mode: 'insert',
    onProgress,
    progressStart: 10,
    progressEnd: 80,
    chunkSize: 800
  });

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
      onProgress(Math.round(80 + ratio * 15));
    }
  }

  // Enriquecer `codigo_item` / `codArticulo` en `produccion_pedidos` si algún producto en planta no tenía su codpt (sin alterar área ni estado)
  if (prodToCodptMap.size > 0) {
    try {
      const { data: existingPlanta } = await supabase
        .from('produccion_pedidos')
        .select('id, pedido_num, codigo_item, data_completa');

      if (existingPlanta && existingPlanta.length > 0) {
        const toEnrich = [];
        for (const p of existingPlanta) {
          const pSin = cleanErpCode(p?.data_completa?.pedidoNum ?? p?.pedido_num);
          const currentCod = cleanErpCode(p?.codigo_item ?? p?.data_completa?.codArticulo ?? p?.data_completa?.codigo_item);
          const prodName = normalizeProductName(p?.data_completa?.nombre ?? p?.data_completa?.descripcion);
          const matchedCodpt = pSin && prodName ? prodToCodptMap.get(`${pSin}__${prodName}`) : null;

          if (matchedCodpt && currentCod !== matchedCodpt) {
            const updatedDataCompleta = {
              ...(p.data_completa || {}),
              codArticulo: matchedCodpt,
              codigo_item: matchedCodpt
            };
            toEnrich.push({
              id: p.id,
              codigo_item: matchedCodpt,
              data_completa: updatedDataCompleta
            });
          }
        }

        for (let i = 0; i < toEnrich.length; i += 25) {
          const slice = toEnrich.slice(i, i + 25);
          await Promise.all(
            slice.map(item =>
              supabase
                .from('produccion_pedidos')
                .update({ codigo_item: item.codigo_item, data_completa: item.data_completa })
                .eq('id', item.id)
            )
          );
        }
      }
    } catch (_) {
      // No interrumpir si no hay registros por enriquecer
    }
  }

  await localforage.removeItem('cdi_mrp_processed_cache_v2');
  if (onProgress) onProgress(100);
  return { insertedCount, updatedInvCount };
};

/**
 * B) Importar `lista de pedidos de produccion.xls` en `ribisoft_pedidos` y `produccion_pedidos`.
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
    let from = 0;
    const step = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('requerimientos_pedido')
        .select('pedido_sin, codpt, producto')
        .not('codpt', 'is', null)
        .range(from, from + step - 1);

      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        for (const r of data) {
          const pSin = cleanErpCode(r.pedido_sin);
          const codpt = cleanErpCode(r.codpt);
          const prod = normalizeProductName(r.producto);
          if (pSin && codpt && prod) {
            prodToCodptMap.set(`${pSin}__${prod}`, codpt);
          }
        }
        from += step;
        if (data.length < step) hasMore = false;
      }
    }
  } catch (_) {}

  const ribisoftPayload = [];
  const candidatesForPlanta = [];

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

    // Columnas exactas verificadas en `ribisoft_pedidos`
    ribisoftPayload.push({
      "PedidoSIN": pedido_sin,
      "Código Ítem": codigo_item || '',
      "Descripción": descripcion,
      "Cliente": cliente,
      "Nombre Proyecto": nombre_proyecto,
      "Estado": estado,
      "Programador": programador,
      "Cantidad": cantidad,
      dim_1: dim_1 !== null && dim_1 !== '' ? String(dim_1).trim() : null,
      dim_2: dim_2 !== null && dim_2 !== '' ? String(dim_2).trim() : null,
      dim_3: dim_3 !== null && dim_3 !== '' ? String(dim_3).trim() : null,
      acabado_1: acabado_1 !== null && acabado_1 !== '' ? String(acabado_1).trim() : null,
      acabado_2: acabado_2 !== null && acabado_2 !== '' ? String(acabado_2).trim() : null,
      acabado_3: acabado_3 !== null && acabado_3 !== '' ? String(acabado_3).trim() : null,
      caracteristicas: caracteristicas !== null && caracteristicas !== '' ? String(caracteristicas).trim() : null,
      programador: programador || null,
      categoria: categoria !== null && categoria !== '' ? String(categoria).trim() : null,
      notas: notas !== null && notas !== '' ? String(notas).trim() : null,
      observaciones_erp: observaciones_erp !== null && observaciones_erp !== '' ? String(observaciones_erp).trim() : null,
      fecha_asigna,
      fecha_genera_ped
    });

    candidatesForPlanta.push({
      pedido_sin,
      codigo_item: codigo_item || '',
      descripcion,
      cliente: cliente || nombre_proyecto || 'N/A',
      nombre_proyecto,
      programador,
      cantidad,
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

  try {
    await adaptiveBatchWrite('ribisoft_pedidos', ribisoftPayload, {
      mode: 'insert',
      onProgress,
      progressStart: 0,
      progressEnd: 50,
      chunkSize: 800
    });
  } catch (err) {
    console.warn('Aviso insertando en ribisoft_pedidos:', err.message);
  }

  const { data: existingPlanta, error: fetchErr } = await supabase
    .from('produccion_pedidos')
    .select('pedido_num, codigo_item, data_completa');

  if (fetchErr) throw fetchErr;

  const existingSet = new Set();
  (existingPlanta || []).forEach(r => {
    const pNum = cleanErpCode(r?.data_completa?.pedidoNum ?? r?.pedido_num);
    const cArt = cleanErpCode(r?.codigo_item ?? r?.data_completa?.codArticulo ?? r?.data_completa?.codigo_item);
    const pName = normalizeProductName(r?.data_completa?.nombre ?? r?.data_completa?.descripcion);
    if (pNum && cArt) existingSet.add(`${pNum}_${cArt}`);
    if (pNum && pName) existingSet.add(`${pNum}__NAME__${pName}`);
  });

  const generateUUID = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });

  const newPlantaRecords = [];
  for (const item of candidatesForPlanta) {
    const codeKey = item.codigo_item ? `${item.pedido_sin}_${item.codigo_item}` : null;
    const nameKey = item.descripcion ? `${item.pedido_sin}__NAME__${normalizeProductName(item.descripcion)}` : null;

    if ((codeKey && existingSet.has(codeKey)) || (nameKey && existingSet.has(nameKey))) {
      continue; // Ya está en planta: NO sobrescribir área ni estado
    }
    if (codeKey) existingSet.add(codeKey);
    if (nameKey) existingSet.add(nameKey);

    const newId = generateUUID();
    const newOrderObj = {
      id: newId,
      pedidoNum: item.pedido_sin,
      codArticulo: item.codigo_item,
      codigo_item: item.codigo_item,
      nombre: item.descripcion,
      cliente: item.cliente,
      cantidad: item.cantidad,
      cantidadRequerida: item.cantidad,
      fechaEntregaPrometida: item.fecha_entrega,
      areaActual: 'Diseño',
      estadoInterno: 'EN ESPERA',
      prioridad: 'NORMAL',
      dim_1: item.dim_1,
      dim_2: item.dim_2,
      dim_3: item.dim_3,
      acabado_1: item.acabado_1,
      acabado_2: item.acabado_2,
      acabado_3: item.acabado_3,
      caracteristicas: item.caracteristicas,
      programador: item.programador,
      nombre_proyecto: item.nombre_proyecto,
      categoria: item.categoria,
      notas: item.notas,
      observaciones_erp: item.observaciones_erp,
      fecha_asigna: item.fecha_asigna,
      fecha_genera_ped: item.fecha_genera_ped,
      creadoEn: new Date().toISOString(),
      bitacoraTurnos: [],
      bitacoraCalidad: [],
      historial: [
        {
          fecha: new Date().toISOString(),
          accion: 'Importación ERP Ribisoft (Ingreso Inicial)',
          entrega: 'ERP RIBISOFT',
          recibe: 'Diseño'
        }
      ]
    };

    // Columnas exactas verificadas en `produccion_pedidos`
    newPlantaRecords.push({
      id: newId,
      pedido_num: item.pedido_sin,
      cliente: item.cliente,
      codigo_item: item.codigo_item || null,
      dim_1: item.dim_1,
      dim_2: item.dim_2,
      dim_3: item.dim_3,
      acabado_1: item.acabado_1,
      acabado_2: item.acabado_2,
      acabado_3: item.acabado_3,
      caracteristicas: item.caracteristicas,
      programador: item.programador || null,
      nombre_proyecto: item.nombre_proyecto || null,
      categoria: item.categoria,
      notas: item.notas,
      observaciones_erp: item.observaciones_erp,
      fecha_asigna: item.fecha_asigna,
      fecha_genera_ped: item.fecha_genera_ped,
      data_completa: newOrderObj
    });
  }

  await adaptiveBatchWrite('produccion_pedidos', newPlantaRecords, {
    mode: 'insert',
    onProgress,
    progressStart: 50,
    progressEnd: 100,
    chunkSize: 500
  });
  if (onProgress) onProgress(100);

  return {
    ribisoftInserted: ribisoftPayload.length,
    plantaInserted: newPlantaRecords.length,
    skippedExisting: candidatesForPlanta.length - newPlantaRecords.length
  };
};

/**
 * C) Importar `ConsultaInventario MUESTRA 3.xlsx` en `inventario`.
 * - Mapea Id Referencia (sin .0), Referencia, Grupo, Subgrupo, Linea, Ubicacion, Id Unidad, Embalaje.
 * - Mantiene el filtro por defecto para priorizar 'Materias Primas e insumos' y 'Herramientas'.
 * - Usa UPSERT sobre "Id Referencia" para no fallar por `inventario_pkey`.
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

  const mappedInventario = Array.from(uniqueInventarioMap.values());

  const importedCount = await adaptiveBatchWrite('inventario', mappedInventario, {
    mode: 'upsert',
    onConflict: 'Id Referencia',
    onProgress,
    progressStart: 0,
    progressEnd: 100,
    chunkSize: 800
  });

  await localforage.removeItem('cdi_mrp_processed_cache_v2');
  if (onProgress) onProgress(100);

  return { importedCount };
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
