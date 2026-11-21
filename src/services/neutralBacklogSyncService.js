import CryptoJS from 'crypto-js';
import { supabase } from '../supabaseClient';
import { cleanErpCode, cleanExcelDate, normalizeProductName } from './ribisoftExcelImporter';
import { buildProductBlueprintQrPayload, showCdiBlueprintToast } from '../utils/colorQrHelper';
import { deepSanitize } from '../utils/security';

const RIBISOFT_NEUTRAL_COLS =
  '"PedidoSIN", "Código Ítem", "Descripción", "Cliente", "Nombre Proyecto", "Programador", "Cantidad", dim_1, dim_2, dim_3, acabado_1, acabado_2, acabado_3, caracteristicas, programador, categoria, notas, observaciones_erp, fecha_asigna';

/**
 * Genera un UUID determinístico RFC 4122 v5 estricto (solo hex `0-9a-f`, versión 5,
 * variante 8/9/a/b) a partir de una clave legible (`neutralKey`).
 * Compatible 100% con columnas `uuid` de PostgreSQL (evita error `22P02`) y evita duplicados.
 */
export const buildDeterministicNeutralUuid = (neutralKey) => {
  const hashHex = CryptoJS.SHA256(
    `cdi-neutral-v5::${String(neutralKey || '').trim().toUpperCase()}`
  ).toString(CryptoJS.enc.Hex);
  const chars = hashHex.slice(0, 32).split('');
  // Byte 6 (índice 12): versión 5 (0101xxxx)
  chars[12] = '5';
  // Byte 8 (índice 16): variante RFC 4122 (10xx -> 8, 9, a, b)
  const variantNibble = (parseInt(chars[16], 16) & 0x3) | 0x8;
  chars[16] = variantNibble.toString(16);
  const h = chars.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

/**
 * Parsea cualquier representación de fecha (ISO, YYYY-MM-DD, DD/MM/YYYY, serial de Excel)
 * y devuelve un objeto { isoDate: 'YYYY-MM-DD', year: Number, month: Number } o null.
 */
export const parseCommercialDeliveryDate = (rawVal) => {
  if (rawVal === undefined || rawVal === null || rawVal === '') return null;

  const str = String(rawVal).trim();
  if (!str || str === '0' || str === '0.0' || str.startsWith('00/00') || str.startsWith('0000-00')) {
    return null;
  }

  // 1. Formato directo YYYY-MM-DD o YYYY/MM/DD (o inicio de ISO YYYY-MM-DDTHH:mm...)
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { isoDate, year, month, day };
    }
  }

  // 2. Formato DD/MM/YYYY o DD-MM-YYYY (con autocorrección si viene MM/DD/YYYY con día > 12)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    let day = Number(dmyMatch[1]);
    let month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (month > 12 && day >= 1 && day <= 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { isoDate, year, month, day };
    }
  }

  // 3. Intentar con cleanExcelDate (soporta números seriales de Excel y Date strings)
  const cleanedIso = cleanExcelDate(rawVal);
  if (cleanedIso) {
    const m = cleanedIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      return { isoDate: `${m[1]}-${m[2]}-${m[3]}`, year, month, day };
    }
  }

  return null;
};

/**
 * Evalúa si una fecha de entrega pertenece a:
 * - Noviembre o Diciembre del presente año (2026, mes >= 11)
 * - Año 2027 completo (o posterior)
 */
export const isTargetBacklogDeliveryDate = (rawVal) => {
  const parsed = parseCommercialDeliveryDate(rawVal);
  if (!parsed) return false;

  const currentYear = 2026; // Año presente de operación
  if (parsed.year === currentYear && parsed.month >= 11) {
    return true;
  }
  if (parsed.year >= 2027) {
    return true;
  }
  return false;
};

/**
 * Extrae una fecha de entrega de cualquier columna posible de una fila de Supabase
 */
const extractRowDeliveryDate = (row) => {
  if (!row || typeof row !== 'object') return null;

  const candidateFields = [
    row.fechaEntrega,
    row.fecha_entrega,
    row.fechaEntregaPrometida,
    row.fecha_entrega_prometida,
    row['Fecha Entrega'],
    row['Fecha de Entrega'],
    row['fecha_compromiso'],
    row['Fecha Compromiso'],
    row['Fecha Despacho'],
    row['fecha_despacho'],
    row.data_completa?.fechaEntrega,
    row.data_completa?.fechaEntregaPrometida,
    row.data_completa?.fecha_entrega
  ];

  for (const cand of candidateFields) {
    const parsed = parseCommercialDeliveryDate(cand);
    if (parsed) return parsed.isoDate;
  }

  // Buscar si en notas u observaciones viene una fecha explícita tipo DD/MM/2026, DD/MM/2027 o 2026-11-XX / 2027-XX-XX
  const textToScan = [
    row.notas,
    row.detalle,
    row.observaciones_erp,
    row['Notas'],
    row['Observaciones'],
    row.data_completa?.notas,
    row.data_completa?.observaciones_erp
  ]
    .filter(Boolean)
    .join(' ');

  if (textToScan) {
    const isoInText = textToScan.match(/\b(202[6-9]-\d{1,2}-\d{1,2})\b/);
    if (isoInText) {
      const p = parseCommercialDeliveryDate(isoInText[1]);
      if (p) return p.isoDate;
    }
    const dmyInText = textToScan.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]202[6-9])\b/);
    if (dmyInText) {
      const p = parseCommercialDeliveryDate(dmyInText[1]);
      if (p) return p.isoDate;
    }
  }

  return null;
};

/**
 * Descarga filas filtradas server-side en lotes de `.in(column, chunk)` para evitar
 * full-table scans de decenas de miles de registros (ahorro masivo de Egress).
 */
const fetchRowsByInBatches = async (tableName, selectCols, filterColumn, values = [], extraFilterFn = null) => {
  const uniqueVals = Array.from(new Set((values || []).map((v) => String(v || '').trim()).filter(Boolean)));
  if (uniqueVals.length === 0) return [];

  const all = [];
  const batchSize = 100;
  for (let i = 0; i < uniqueVals.length; i += batchSize) {
    const slice = uniqueVals.slice(i, i + batchSize);
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from(tableName)
        .select(selectCols)
        .in(filterColumn, slice);
      if (typeof extraFilterFn === 'function') {
        query = extraFilterFn(query);
      }
      const { data, error } = await query.range(from, from + step - 1);
      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        all.push(...data);
        from += step;
        if (data.length < step) hasMore = false;
      }
    }
  }
  return all;
};

/**
 * Descarga filas acotadas por un filtro server-side opcional (máximo `maxRows`)
 */
const fetchFilteredRows = async (tableName, selectCols, filterFn = null, maxRows = 3000) => {
  const all = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore && all.length < maxRows) {
    let query = supabase.from(tableName).select(selectCols);
    if (typeof filterFn === 'function') {
      query = filterFn(query);
    }
    const { data, error } = await query.range(from, from + step - 1);
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      all.push(...data);
      from += step;
      if (data.length < step) hasMore = false;
    }
  }
  return all;
};

/**
 * Sincroniza hacia el Área Neutra (`AREA_NEUTRA` / `PENDIENTE_INGENIERIA`) todos los pedidos
 * almacenados en las tablas de Supabase (`coordinacion_alertas`, `ribisoft_pedidos`, `produccion_pedidos`)
 * cuya fecha de entrega comercial sea de Noviembre del presente año (2026-11-01) en adelante y los del 2027.
 * Utiliza proyecciones explícitas y filtros server-side (0 `select('*')` ni full-table scans).
 */
export const syncNov2026And2027OrdersToNeutralArea = async ({
  currentOrders = [],
  currentAlerts = [],
  onComplete = null,
  silent = false
} = {}) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user) {
      if (!silent) {
        alert('🔒 Debes tener sesión iniciada para sincronizar los pedidos desde Supabase.');
      }
      return { syncedOrdersCount: 0, syncedPedidosCount: 0 };
    }

    // 1. Consulta acotada server-side: alertas comerciales + únicamente filas de `ribisoft_pedidos` con fecha >= 2026-11-01
    const [alertasRows, ribisoftDatedRows] = await Promise.all([
      fetchFilteredRows('coordinacion_alertas', 'id, data_completa', null, 1000).catch(() => []),
      fetchFilteredRows(
        'ribisoft_pedidos',
        RIBISOFT_NEUTRAL_COLS,
        (q) => q.gte('fecha_asigna', '2026-11-01'),
        3000
      ).catch(() => [])
    ]);

    // 2. Construir diccionario de Fechas de Entrega Comercial por Pedido (`targetPedidosMap`)
    //    SOLO para pedidos con fecha >= 2026-11-01 y 2027
    const targetPedidosMap = new Map(); // pedidoNum -> { pedidoNum, fechaEntrega, cliente, notas }

    const registerCandidatePedido = (rawPedido, rawFecha, rawCliente, rawNotas) => {
      const pedClean = cleanErpCode(rawPedido);
      if (!pedClean) return;
      const pedUpper = String(pedClean).replace(/^#/, '').trim().toUpperCase();
      if (!pedUpper) return;

      if (!isTargetBacklogDeliveryDate(rawFecha)) return;
      const parsedDate = parseCommercialDeliveryDate(rawFecha);
      if (!parsedDate) return;

      const existing = targetPedidosMap.get(pedUpper);
      targetPedidosMap.set(pedUpper, {
        pedidoNum: pedUpper,
        fechaEntrega: parsedDate.isoDate,
        cliente:
          String(rawCliente || existing?.cliente || '').trim().toUpperCase() ||
          'CLIENTE COMERCIAL',
        notas: String(rawNotas || existing?.notas || '').trim()
      });
    };

    // 2.1. Revisar alertas en memoria y en tabla `coordinacion_alertas`
    for (const a of currentAlerts || []) {
      if (!a || a.tipoRegistro === 'PACKING_LIST') continue;
      registerCandidatePedido(
        a.pedidoNum || a.pedido_num,
        extractRowDeliveryDate(a),
        a.cliente,
        a.notas || a.detalle
      );
    }

    for (const row of alertasRows || []) {
      const d = row?.data_completa && typeof row.data_completa === 'object' ? row.data_completa : row;
      if (!d || d.tipoRegistro === 'PACKING_LIST') continue;
      registerCandidatePedido(
        d.pedidoNum || d.pedido_num || row.pedido_num,
        extractRowDeliveryDate(d) || extractRowDeliveryDate(row),
        d.cliente || row.cliente,
        d.notas || d.detalle
      );
    }

    // 2.2. Revisar filas en `ribisoft_pedidos` ya filtradas por fecha_asigna >= 2026-11-01
    for (const r of ribisoftDatedRows || []) {
      const ped = r['PedidoSIN'] ?? r['pedido_sin'] ?? r['pedidosin'] ?? r['Pedido'];
      const rowDate = extractRowDeliveryDate(r) || r['fecha_asigna'];
      if (ped && rowDate) {
        registerCandidatePedido(
          ped,
          rowDate,
          r['Cliente'] ?? r['cliente'] ?? r['Nombre Proyecto'] ?? r['nombre_proyecto'],
          r['Observaciones'] ?? r['observaciones_erp'] ?? r['Notas'] ?? r['notas']
        );
      }
    }

    // 2.3. Revisar órdenes ya cargadas en memoria que tengan fechaEntregaPrometida >= Nov 2026 / 2027
    for (const ord of currentOrders || []) {
      if (!ord || ord.tipoRegistro === 'PACKING_LIST' || String(ord.id || '').startsWith('PACKLIST_')) continue;
      const ped = ord.pedidoNum || ord.pedido_num;
      const rowDate = extractRowDeliveryDate(ord);
      if (ped && rowDate) {
        registerCandidatePedido(ped, rowDate, ord.cliente, ord.notas);
      }
    }

    if (targetPedidosMap.size === 0) {
      return { syncedOrdersCount: 0, syncedPedidosCount: 0, targetPedidos: [] };
    }

    const targetPedidoNums = Array.from(targetPedidosMap.keys());

    // 3. Traer ÚNICAMENTE las filas pertenecientes a `targetPedidoNums` mediante `.in(...)` server-side
    //    (Evita descargar las 42,000 filas de requerimientos_pedido y 9,000 filas de ribisoft_pedidos)
    const [ribisoftByPedidoRows, produccionRows, reqRows] = await Promise.all([
      fetchRowsByInBatches('ribisoft_pedidos', RIBISOFT_NEUTRAL_COLS, 'PedidoSIN', targetPedidoNums).catch(() => []),
      fetchRowsByInBatches(
        'produccion_pedidos',
        'id, pedido_num, codigo_item, data_completa',
        'pedido_num',
        targetPedidoNums
      ).catch(() => []),
      fetchRowsByInBatches(
        'requerimientos_pedido',
        'pedido_sin, codpt, producto',
        'pedido_sin',
        targetPedidoNums,
        (q) => q.not('codpt', 'is', null)
      ).catch(() => [])
    ]);

    const ribisoftRows = [...(ribisoftByPedidoRows || []), ...(ribisoftDatedRows || [])];

    // 3.1. Construir mapa (pedido_sin + producto) -> codpt solo con los pedidos objetivo
    const prodToCodptMap = new Map();
    for (const r of reqRows || []) {
      const pSin = cleanErpCode(r.pedido_sin ?? r.pedidosin);
      const codpt = cleanErpCode(r.codpt);
      const prodNorm = normalizeProductName(r.producto);
      if (pSin && codpt && prodNorm) {
        prodToCodptMap.set(`${pSin}__${prodNorm}`, codpt);
      }
    }

    // 4. Agrupar todos los productos de `ribisoft_pedidos` pertenecientes a los pedidos objetivo
    const ribiItemsByPedido = new Map();
    for (const r of ribisoftRows || []) {
      const rawPed = cleanErpCode(r['PedidoSIN'] ?? r['pedido_sin'] ?? r['pedidosin'] ?? r['Pedido']);
      if (!rawPed) continue;
      const pedUpper = String(rawPed).replace(/^#/, '').trim().toUpperCase();
      if (!targetPedidosMap.has(pedUpper)) continue;

      const desc = String(
        r['Descripción'] ?? r['Descripcion'] ?? r['descripcion'] ?? r['Producto'] ?? r['producto'] ?? ''
      ).trim();
      const normDesc = normalizeProductName(desc);
      let codArt = cleanErpCode(r['Código Ítem'] ?? r['codigo_item'] ?? r['codpt'] ?? '');
      if (!codArt && normDesc && prodToCodptMap.has(`${pedUpper}__${normDesc}`)) {
        codArt = prodToCodptMap.get(`${pedUpper}__${normDesc}`);
      }

      if (!codArt && !normDesc) continue;

      if (!ribiItemsByPedido.has(pedUpper)) {
        ribiItemsByPedido.set(pedUpper, new Map());
      }
      const pedItemsMap = ribiItemsByPedido.get(pedUpper);
      const dedupKey = `${pedUpper}__${normDesc || codArt}`;
      const existing = pedItemsMap.get(dedupKey);

      if (!existing || (!existing.codArticulo && codArt)) {
        pedItemsMap.set(dedupKey, {
          pedidoNum: pedUpper,
          codArticulo: (codArt || 'S/C').toUpperCase(),
          nombre: (normDesc || 'PRODUCTO COMERCIAL').toUpperCase(),
          cantidad: Number(r['Cantidad'] ?? r['cantidad']) || 1,
          cliente: String(
            r['Cliente'] ??
              r['cliente'] ??
              r['Nombre Proyecto'] ??
              targetPedidosMap.get(pedUpper)?.cliente ??
              'CLIENTE COMERCIAL'
          )
            .trim()
            .toUpperCase(),
          proyecto: String(r['Nombre Proyecto'] ?? r['nombre_proyecto'] ?? '').trim().toUpperCase(),
          programador: String(r['Programador'] ?? r['programador'] ?? '').trim().toUpperCase(),
          dim_1: r['dim_1'] ?? r['Dim.1'] ?? null,
          dim_2: r['dim_2'] ?? r['Dim.2'] ?? null,
          dim_3: r['dim_3'] ?? r['Dim.3'] ?? null,
          acabado_1: r['acabado_1'] ?? r['Acabado1'] ?? null,
          acabado_2: r['acabado_2'] ?? r['Acabado2'] ?? null,
          acabado_3: r['acabado_3'] ?? r['Acabado3'] ?? null,
          caracteristicas: r['caracteristicas'] ?? r['Características'] ?? null,
          categoria: r['categoria'] ?? r['Categoria'] ?? null,
          notas: r['notas'] ?? r['Notas'] ?? null,
          observaciones_erp: r['observaciones_erp'] ?? r['Observaciones'] ?? null
        });
      }
    }

    // 5. Indexar órdenes actualmente existentes en `produccion_pedidos`
    const existingPlantByPedido = new Map();
    for (const r of produccionRows || []) {
      const d = r?.data_completa;
      if (!d || typeof d !== 'object' || !d.pedidoNum) continue;
      if (d.tipoRegistro === 'PACKING_LIST' || String(r?.id || '').startsWith('PACKLIST_')) continue;
      const pedUpper = String(d.pedidoNum).replace(/^#/, '').trim().toUpperCase();
      if (!existingPlantByPedido.has(pedUpper)) {
        existingPlantByPedido.set(pedUpper, []);
      }
      existingPlantByPedido.get(pedUpper).push(d);
    }

    const nowIso = new Date().toISOString();
    const upsertsForProduccion = [];
    const newOrUpdatedOrdersMap = new Map();
    const touchedPedidosSet = new Set();

    // 6. Procesar cada pedido con fecha >= Noviembre 2026 y 2027
    for (const [pedUpper, meta] of targetPedidosMap.entries()) {
      const ribiItemsMap = ribiItemsByPedido.get(pedUpper);
      const ribiItems = ribiItemsMap ? Array.from(ribiItemsMap.values()) : [];
      const existingItems = existingPlantByPedido.get(pedUpper) || [];

      if (ribiItems.length > 0) {
        // Caso A: El pedido tiene desglose de ítems en `ribisoft_pedidos`
        ribiItems.forEach((erpItem, idx) => {
          // Buscar si este ítem ya existe en `produccion_pedidos`
          const matchedExisting = existingItems.find((ex) => {
            const exCod = String(ex.codArticulo || ex.codigo_item || '').trim().toUpperCase();
            const exNom = normalizeProductName(ex.nombre || ex.descripcion);
            if (erpItem.codArticulo && erpItem.codArticulo !== 'S/C' && exCod) {
              if (erpItem.codArticulo === exCod) return true;
            }
            if (erpItem.nombre && exNom && erpItem.nombre === exNom) {
              return true;
            }
            return false;
          });

          if (!matchedExisting) {
            // Crear nuevo registro en Área Neutra / Backlog con UUID RFC 4122 v5 determinístico
            const safeCod =
              erpItem.codArticulo && erpItem.codArticulo !== 'S/C'
                ? erpItem.codArticulo.replace(/[^A-Z0-9_-]/gi, '')
                : `ITEM_${idx + 1}`;
            const neutralKey = `NEUTRAL_${pedUpper}_${safeCod}_${idx + 1}`;
            const deterministicId = buildDeterministicNeutralUuid(neutralKey);

            const newOrderObj = deepSanitize({
              id: deterministicId,
              neutralKey,
              pedidoNum: pedUpper,
              codArticulo: erpItem.codArticulo,
              codigo_item: erpItem.codArticulo,
              qr_plano_payload: buildProductBlueprintQrPayload({
                id: deterministicId,
                pedidoNum: pedUpper,
                codArticulo: erpItem.codArticulo
              }),
              nombre: erpItem.nombre,
              cantidad: erpItem.cantidad,
              cliente: erpItem.cliente || meta.cliente,
              area: 'AREA_NEUTRA',
              areaActual: 'Área Neutra / Backlog',
              estado: 'PENDIENTE_INGENIERIA',
              estadoInterno: 'PENDIENTE_INGENIERIA',
              prioridad: 'NORMAL',
              fechaIngresoArea: nowIso,
              fechaEntregaPrometida: meta.fechaEntrega,
              dim_1: erpItem.dim_1,
              dim_2: erpItem.dim_2,
              dim_3: erpItem.dim_3,
              acabado_1: erpItem.acabado_1,
              acabado_2: erpItem.acabado_2,
              acabado_3: erpItem.acabado_3,
              caracteristicas: erpItem.caracteristicas,
              programador: erpItem.programador,
              nombre_proyecto: erpItem.proyecto,
              categoria: erpItem.categoria,
              notas: erpItem.notas || meta.notas || null,
              observaciones_erp: erpItem.observaciones_erp,
              bitacoraTurnos: [],
              bitacoraCalidad: [],
              historial: [
                {
                  fecha: nowIso,
                  accion: `Ingreso a Área Neutra / Backlog (Entrega Comercial: ${meta.fechaEntrega})`,
                  entrega: 'ASESOR COMERCIAL',
                  recibe: 'ÁREA NEUTRA / INGENIERÍA'
                }
              ]
            });

            upsertsForProduccion.push({
              id: newOrderObj.id,
              pedido_num: pedUpper,
              cliente: newOrderObj.cliente,
              codigo_item: newOrderObj.codArticulo,
              areas_compartidas: [],
              asignado_a: [],
              data_completa: newOrderObj
            });
            newOrUpdatedOrdersMap.set(newOrderObj.id, newOrderObj);
            touchedPedidosSet.add(pedUpper);
          } else {
            // El ítem ya existe en `produccion_pedidos`:
            // Si aún no tiene fechaEntregaPrometida o si no ha iniciado movimiento real en secciones de planta, asegurar que esté en Área Neutra con su fecha comercial
            const hasPlantWork =
              (Array.isArray(matchedExisting.bitacoraTurnos) && matchedExisting.bitacoraTurnos.length > 0) ||
              (Array.isArray(matchedExisting.bitacoraCalidad) && matchedExisting.bitacoraCalidad.length > 0) ||
              matchedExisting.estadoInterno === 'DESPACHADO' ||
              Boolean(matchedExisting.isTerminado) ||
              (Array.isArray(matchedExisting.historial) && matchedExisting.historial.length > 1);

            const alreadyInNeutral =
              matchedExisting.area === 'AREA_NEUTRA' ||
              matchedExisting.areaActual === 'Área Neutra / Backlog';

            const needsDateUpdate = matchedExisting.fechaEntregaPrometida !== meta.fechaEntrega;
            const shouldMoveToNeutral = !hasPlantWork && !alreadyInNeutral;

            if (needsDateUpdate || shouldMoveToNeutral) {
              const updatedOrderObj = deepSanitize({
                ...matchedExisting,
                fechaEntregaPrometida: meta.fechaEntrega,
                area: shouldMoveToNeutral ? 'AREA_NEUTRA' : (matchedExisting.area || matchedExisting.areaActual),
                areaActual: shouldMoveToNeutral ? 'Área Neutra / Backlog' : matchedExisting.areaActual,
                estado: shouldMoveToNeutral ? 'PENDIENTE_INGENIERIA' : (matchedExisting.estado || matchedExisting.estadoInterno),
                estadoInterno: shouldMoveToNeutral ? 'PENDIENTE_INGENIERIA' : matchedExisting.estadoInterno,
                qr_plano_payload:
                  matchedExisting.qr_plano_payload ||
                  buildProductBlueprintQrPayload(matchedExisting)
              });

              upsertsForProduccion.push({
                id: updatedOrderObj.id,
                pedido_num: pedUpper,
                cliente: updatedOrderObj.cliente || meta.cliente,
                codigo_item: updatedOrderObj.codArticulo || updatedOrderObj.codigo_item || null,
                areas_compartidas: updatedOrderObj.areas_compartidas || [],
                asignado_a: Array.isArray(updatedOrderObj.asignado_a) ? updatedOrderObj.asignado_a : [],
                data_completa: updatedOrderObj
              });
              newOrUpdatedOrdersMap.set(updatedOrderObj.id, updatedOrderObj);
              touchedPedidosSet.add(pedUpper);
            }
          }
        });
      } else if (existingItems.length > 0) {
        // Caso B: El pedido ya existe en `produccion_pedidos` (sin filas en ribisoft_pedidos)
        existingItems.forEach((ex) => {
          const hasPlantWork =
            (Array.isArray(ex.bitacoraTurnos) && ex.bitacoraTurnos.length > 0) ||
            (Array.isArray(ex.bitacoraCalidad) && ex.bitacoraCalidad.length > 0) ||
            ex.estadoInterno === 'DESPACHADO' ||
            Boolean(ex.isTerminado) ||
            (Array.isArray(ex.historial) && ex.historial.length > 1);

          const alreadyInNeutral =
            ex.area === 'AREA_NEUTRA' || ex.areaActual === 'Área Neutra / Backlog';
          const needsDateUpdate = ex.fechaEntregaPrometida !== meta.fechaEntrega;
          const shouldMoveToNeutral = !hasPlantWork && !alreadyInNeutral;

          if (needsDateUpdate || shouldMoveToNeutral) {
            const updatedOrderObj = deepSanitize({
              ...ex,
              fechaEntregaPrometida: meta.fechaEntrega,
              area: shouldMoveToNeutral ? 'AREA_NEUTRA' : (ex.area || ex.areaActual),
              areaActual: shouldMoveToNeutral ? 'Área Neutra / Backlog' : ex.areaActual,
              estado: shouldMoveToNeutral ? 'PENDIENTE_INGENIERIA' : (ex.estado || ex.estadoInterno),
              estadoInterno: shouldMoveToNeutral ? 'PENDIENTE_INGENIERIA' : ex.estadoInterno,
              qr_plano_payload: ex.qr_plano_payload || buildProductBlueprintQrPayload(ex)
            });

            upsertsForProduccion.push({
              id: updatedOrderObj.id,
              pedido_num: pedUpper,
              cliente: updatedOrderObj.cliente || meta.cliente,
              codigo_item: updatedOrderObj.codArticulo || updatedOrderObj.codigo_item || null,
              areas_compartidas: updatedOrderObj.areas_compartidas || [],
              asignado_a: Array.isArray(updatedOrderObj.asignado_a) ? updatedOrderObj.asignado_a : [],
              data_completa: updatedOrderObj
            });
            newOrUpdatedOrdersMap.set(updatedOrderObj.id, updatedOrderObj);
            touchedPedidosSet.add(pedUpper);
          }
        });
      } else {
        // Caso C: El pedido fue registrado por el asesor comercial en `coordinacion_alertas` con fecha >= Nov 2026 / 2027,
        // pero aún no tiene filas desglosadas en `ribisoft_pedidos` ni en `produccion_pedidos`.
        const neutralKey = `NEUTRAL_${pedUpper}_COMERCIAL_1`;
        const deterministicId = buildDeterministicNeutralUuid(neutralKey);
        const codArt = `PED-${pedUpper}`;
        const newOrderObj = deepSanitize({
          id: deterministicId,
          neutralKey,
          pedidoNum: pedUpper,
          codArticulo: codArt,
          codigo_item: codArt,
          qr_plano_payload: buildProductBlueprintQrPayload({
            id: deterministicId,
            pedidoNum: pedUpper,
            codArticulo: codArt
          }),
          nombre: (meta.notas || `PEDIDO COMERCIAL #${pedUpper} (PENDIENTE DESGLOSE DE ÍTEMS)`).toUpperCase(),
          cantidad: 1,
          cliente: meta.cliente || 'CLIENTE COMERCIAL',
          area: 'AREA_NEUTRA',
          areaActual: 'Área Neutra / Backlog',
          estado: 'PENDIENTE_INGENIERIA',
          estadoInterno: 'PENDIENTE_INGENIERIA',
          prioridad: 'NORMAL',
          fechaIngresoArea: nowIso,
          fechaEntregaPrometida: meta.fechaEntrega,
          notas: meta.notas || null,
          bitacoraTurnos: [],
          bitacoraCalidad: [],
          historial: [
            {
              fecha: nowIso,
              accion: `Ingreso a Área Neutra / Backlog desde Programación Comercial (Entrega: ${meta.fechaEntrega})`,
              entrega: 'ASESOR COMERCIAL',
              recibe: 'ÁREA NEUTRA / INGENIERÍA'
            }
          ]
        });

        upsertsForProduccion.push({
          id: newOrderObj.id,
          pedido_num: pedUpper,
          cliente: newOrderObj.cliente,
          codigo_item: newOrderObj.codArticulo,
          areas_compartidas: [],
          asignado_a: [],
          data_completa: newOrderObj
        });
        newOrUpdatedOrdersMap.set(newOrderObj.id, newOrderObj);
        touchedPedidosSet.add(pedUpper);
      }
    }

    // 7. Guardar en lotes en `produccion_pedidos` de Supabase
    if (upsertsForProduccion.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < upsertsForProduccion.length; i += chunkSize) {
        const chunk = upsertsForProduccion.slice(i, i + chunkSize);
        const { error } = await supabase.from('produccion_pedidos').upsert(chunk);
        if (error) {
          console.error('Error guardando lote en Área Neutra:', error);
        }
      }
    }

    // 8. Actualizar estado en memoria si se proveyó callback
    if (onComplete && newOrUpdatedOrdersMap.size > 0) {
      onComplete(newOrUpdatedOrdersMap);
    }

    if (!silent && upsertsForProduccion.length > 0) {
      showCdiBlueprintToast(
        `✅ ${touchedPedidosSet.size} pedido(s) (${upsertsForProduccion.length} ítems) de Nov 2026 y 2027 cargados en Área Neutra`
      );
    }

    return {
      syncedOrdersCount: upsertsForProduccion.length,
      syncedPedidosCount: touchedPedidosSet.size,
      totalMatchedCommercialPedidos: targetPedidosMap.size
    };
  } catch (err) {
    console.error('Error sincronizando pedidos de Nov 2026 y 2027 al Área Neutra:', err);
    return { syncedOrdersCount: 0, syncedPedidosCount: 0, error: err.message };
  }
};
