import { supabase } from '../supabaseClient';

/**
 * Limpia códigos numéricos exportados por Excel con decimales (.0),
 * devolviendo un String entero limpio (ej: 33000070.0 -> '33000070').
 */
export const cleanErpCode = (val) => {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const num = Number(val);
  if (!Number.isNaN(num) && Number.isFinite(num)) {
    return String(Math.trunc(num)).trim();
  }
  return String(val).replace(/\.0+$/, '').trim();
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
 * Extrae o limpia el código de producto terminado (3300xxxx) desde la fila de Excel.
 */
export const extractCodigoItem = (row) => {
  const rawCode =
    row['codigo_item'] ??
    row['Código Ítem'] ??
    row['Codigo Item'] ??
    row['codpt'] ??
    row['CodPT'] ??
    row['Código'] ??
    row['Codigo'];

  if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
    return cleanErpCode(rawCode);
  }

  // Intentar extraer código 3300xxxx si viene concatenado en Descripción / Producto
  const desc = String(row['Descripción'] ?? row['Descripcion'] ?? row['producto'] ?? row['Producto'] ?? '');
  const match = desc.match(/\b(33\d{6,})\b/);
  return match ? match[1] : null;
};

/**
 * A) Importar MATERIALES REQUERIDOS PARA PEDIDOS.xls en `requerimientos_pedido`
 * y actualizar `existencia` y `ubicacion` en `inventario` cuando coincida `idreferencia`.
 */
export const importMaterialesRequeridosRows = async (rows, onProgress) => {
  const mappedRows = [];
  const inventoryUpdatesMap = new Map();

  for (const row of rows) {
    const pedidoSinRaw = row['pedido_sin'] ?? row['pedidosin'] ?? row['PedidoSIN'];
    const pedido_sin = pedidoSinRaw !== undefined && pedidoSinRaw !== null && String(pedidoSinRaw).trim() !== ''
      ? cleanErpCode(pedidoSinRaw)
      : null;

    if (!pedido_sin) continue;

    // CRÍTICO: En Excel codpt viene como float 33000070.0 -> limpiar obligatoriamente
    const codpt = row['codpt'] !== undefined && row['codpt'] !== null && String(row['codpt']).trim() !== ''
      ? String(Math.trunc(Number(row['codpt']))).trim()
      : null;

    const rawIdRef = row['idreferencia'] ?? row['Id Referencia'] ?? row['id_referencia'];
    const idreferencia = rawIdRef !== undefined && rawIdRef !== null && String(rawIdRef).trim() !== ''
      ? (Number.isNaN(Number(rawIdRef)) ? String(rawIdRef).replace(/\.0+$/, '').trim() : String(Math.trunc(Number(rawIdRef))).trim())
      : null;

    if (!idreferencia) continue;

    const numero_rq = row['numero'] !== undefined && row['numero'] !== null
      ? String(row['numero']).trim()
      : (row['numero_rq'] ? String(row['numero_rq']).trim() : null);

    const pedido_cot = row['pedido'] !== undefined && row['pedido'] !== null
      ? cleanErpCode(row['pedido'])
      : (row['pedido_cot'] ? cleanErpCode(row['pedido_cot']) : null);

    const producto = row['producto'] !== undefined && row['producto'] !== null
      ? String(row['producto']).trim()
      : null;

    const referencia = row['referencia'] !== undefined && row['referencia'] !== null
      ? String(row['referencia']).trim()
      : (row['Descripcion'] ? String(row['Descripcion']).trim() : null);

    const idunidad = row['idunidad'] !== undefined && row['idunidad'] !== null
      ? String(row['idunidad']).trim()
      : (row['Id Unidad'] ? String(row['Id Unidad']).trim() : null);

    const fecha_solicitud = row['Fecha Solicitud'] ?? row['fecha_solicitud'] ?? null;
    const pedida_reser = toSafeNumber(row['pedida(reser)'] ?? row['pedida_reser'] ?? row['Cantidad']);
    const cant_oc = toSafeNumber(row['cant_oc'] ?? row['Cant.OC']);
    const entregada = toSafeNumber(row['entregada']);
    const pendiente = row['pendiente'] !== undefined && row['pendiente'] !== null && row['pendiente'] !== ''
      ? toSafeNumber(row['pendiente'])
      : Math.max(0, pedida_reser - entregada);
    const existencia = toSafeNumber(row['existencia']);
    const ubicacion = row['Ubicación'] !== undefined && row['Ubicación'] !== null
      ? String(row['Ubicación']).trim()
      : (row['Ubicacion'] !== undefined && row['Ubicacion'] !== null
          ? String(row['Ubicacion']).trim()
          : (row['ubicacion'] ? String(row['ubicacion']).trim() : null));

    mappedRows.push({
      numero_rq,
      pedido_cot,
      pedido_sin,
      codpt: codpt && codpt !== 'NaN' ? codpt : null,
      producto,
      idreferencia,
      referencia,
      idunidad,
      fecha_solicitud: fecha_solicitud ? String(fecha_solicitud).trim() : null,
      pedida_reser,
      cant_oc,
      entregada,
      pendiente,
      existencia,
      ubicacion
    });

    inventoryUpdatesMap.set(idreferencia, {
      idreferencia,
      existencia,
      ubicacion
    });
  }

  // Insertar en lotes de 500 en requerimientos_pedido
  const chunkSize = 500;
  let insertedCount = 0;
  for (let i = 0; i < mappedRows.length; i += chunkSize) {
    const chunk = mappedRows.slice(i, i + chunkSize);
    const { error } = await supabase.from('requerimientos_pedido').insert(chunk);
    if (error) throw error;
    insertedCount += chunk.length;
    if (onProgress) onProgress(Math.round((insertedCount / mappedRows.length) * 75));
  }

  // Actualizar existencia y ubicacion en inventario cuando coincida idreferencia
  let updatedInvCount = 0;
  const invUpdates = Array.from(inventoryUpdatesMap.values());
  for (const upd of invUpdates) {
    const updatePayload = { existencia: upd.existencia };
    if (upd.ubicacion) updatePayload.ubicacion = upd.ubicacion;

    const { error } = await supabase
      .from('inventario')
      .update(updatePayload)
      .eq('idreferencia', upd.idreferencia);

    if (!error) updatedInvCount++;
  }

  if (onProgress) onProgress(100);
  return { insertedCount, updatedInvCount };
};

/**
 * B) Importar `lista de pedidos de produccion.xls` en `ribisoft_pedidos` y `produccion_pedidos`.
 * - Ignora filas donde Anulado === true o Descartado === true.
 * - Conserva codigo_item / Código Ítem (3300xxxx) para cruzar con codpt.
 * - Guarda dimensiones, acabados, caracteristicas, programador, nombre_proyecto, categoria, notas, observaciones_erp, fecha_asigna y fecha_genera_ped.
 * - En produccion_pedidos SOLO inserta artículos nuevos; NO sobrescribe el área ni el estado de los productos que ya están en planta.
 */
export const importPedidosProduccionRows = async (rows, onProgress) => {
  const validRows = rows.filter(row => {
    const anulado = isTruthyExcelFlag(row['Anulado'] ?? row['anulado']);
    const descartado = isTruthyExcelFlag(row['Descartado'] ?? row['descartado']);
    return !anulado && !descartado;
  });

  const ribisoftPayload = [];
  const candidatesForPlanta = [];

  for (const row of validRows) {
    const rawPedido = row['PedidoSIN'] ?? row['pedido_sin'] ?? row['pedidosin'] ?? row['Pedido'];
    const pedido_sin = cleanErpCode(rawPedido);
    if (!pedido_sin) continue;

    const codigo_item = extractCodigoItem(row);
    const descripcion = String(row['Descripción'] ?? row['Descripcion'] ?? row['descripcion'] ?? row['Producto'] ?? row['producto'] ?? '').trim();
    const cliente = String(row['Cliente'] ?? row['cliente'] ?? row['Nombre Proyecto'] ?? row['nombre_proyecto'] ?? '').trim();
    const nombre_proyecto = String(row['Nombre Proyecto'] ?? row['nombre_proyecto'] ?? row['Proyecto'] ?? '').trim();
    const programador = String(row['Programador'] ?? row['programador'] ?? '').trim();
    const cantidad = toSafeNumber(row['Cantidad'] ?? row['cantidad'] ?? 1) || 1;
    const estado = String(row['Estado'] ?? row['estado'] ?? '').trim();

    const dim_1 = row['dim_1'] ?? row['Dim 1'] ?? row['Dim1'] ?? row['Dim_1'] ?? null;
    const dim_2 = row['dim_2'] ?? row['Dim 2'] ?? row['Dim2'] ?? row['Dim_2'] ?? null;
    const dim_3 = row['dim_3'] ?? row['Dim 3'] ?? row['Dim3'] ?? row['Dim_3'] ?? null;

    const acabado_1 = row['acabado_1'] ?? row['Acabado 1'] ?? row['Acabado1'] ?? row['Acabado_1'] ?? null;
    const acabado_2 = row['acabado_2'] ?? row['Acabado 2'] ?? row['Acabado2'] ?? row['Acabado_2'] ?? null;
    const acabado_3 = row['acabado_3'] ?? row['Acabado 3'] ?? row['Acabado3'] ?? row['Acabado_3'] ?? null;

    const caracteristicas = row['caracteristicas'] ?? row['Características'] ?? row['Caracteristicas'] ?? null;
    const categoria = row['categoria'] ?? row['Categoría'] ?? row['Categoria'] ?? null;
    const notas = row['notas'] ?? row['Notas'] ?? null;
    const observaciones_erp = row['observaciones_erp'] ?? row['Observaciones ERP'] ?? row['Observaciones'] ?? row['observaciones'] ?? null;
    const fecha_asigna = row['fecha_asigna'] ?? row['Fecha Asigna'] ?? null;
    const fecha_genera_ped = row['fecha_genera_ped'] ?? row['Fecha Genera Ped'] ?? row['Fecha Genera'] ?? null;
    const fecha_entrega = row['Fecha Entrega'] ?? row['fecha_entrega'] ?? null;

    ribisoftPayload.push({
      "PedidoSIN": pedido_sin,
      "Código Ítem": codigo_item || '',
      "Descripción": descripcion,
      "Cliente": cliente,
      "Nombre Proyecto": nombre_proyecto,
      "Estado": estado,
      "Programador": programador,
      "Cantidad": cantidad,
      codigo_item: codigo_item || null,
      dim_1: dim_1 !== null ? String(dim_1).trim() : null,
      dim_2: dim_2 !== null ? String(dim_2).trim() : null,
      dim_3: dim_3 !== null ? String(dim_3).trim() : null,
      acabado_1: acabado_1 !== null ? String(acabado_1).trim() : null,
      acabado_2: acabado_2 !== null ? String(acabado_2).trim() : null,
      acabado_3: acabado_3 !== null ? String(acabado_3).trim() : null,
      caracteristicas: caracteristicas !== null ? String(caracteristicas).trim() : null,
      programador: programador || null,
      nombre_proyecto: nombre_proyecto || null,
      categoria: categoria !== null ? String(categoria).trim() : null,
      notas: notas !== null ? String(notas).trim() : null,
      observaciones_erp: observaciones_erp !== null ? String(observaciones_erp).trim() : null,
      fecha_asigna: fecha_asigna !== null ? String(fecha_asigna).trim() : null,
      fecha_genera_ped: fecha_genera_ped !== null ? String(fecha_genera_ped).trim() : null
    });

    candidatesForPlanta.push({
      pedido_sin,
      codigo_item: codigo_item || '',
      descripcion,
      cliente: cliente || nombre_proyecto || 'N/A',
      nombre_proyecto,
      programador,
      cantidad,
      fecha_entrega: fecha_entrega ? String(fecha_entrega).trim() : null,
      dim_1: dim_1 !== null ? String(dim_1).trim() : null,
      dim_2: dim_2 !== null ? String(dim_2).trim() : null,
      dim_3: dim_3 !== null ? String(dim_3).trim() : null,
      acabado_1: acabado_1 !== null ? String(acabado_1).trim() : null,
      acabado_2: acabado_2 !== null ? String(acabado_2).trim() : null,
      acabado_3: acabado_3 !== null ? String(acabado_3).trim() : null,
      caracteristicas: caracteristicas !== null ? String(caracteristicas).trim() : null,
      categoria: categoria !== null ? String(categoria).trim() : null,
      notas: notas !== null ? String(notas).trim() : null,
      observaciones_erp: observaciones_erp !== null ? String(observaciones_erp).trim() : null,
      fecha_asigna: fecha_asigna !== null ? String(fecha_asigna).trim() : null,
      fecha_genera_ped: fecha_genera_ped !== null ? String(fecha_genera_ped).trim() : null
    });
  }

  // 1. Insertar en ribisoft_pedidos en lotes
  const chunkSize = 500;
  for (let i = 0; i < ribisoftPayload.length; i += chunkSize) {
    const chunk = ribisoftPayload.slice(i, i + chunkSize);
    const { error } = await supabase.from('ribisoft_pedidos').insert(chunk);
    if (error) {
      console.warn('Aviso insertando lote en ribisoft_pedidos:', error.message);
    }
  }

  if (onProgress) onProgress(50);

  // 2. Consultar produccion_pedidos actuales para NO sobrescribir área ni estado de productos ya en planta
  const { data: existingPlanta, error: fetchErr } = await supabase
    .from('produccion_pedidos')
    .select('pedido_num, data_completa');

  if (fetchErr) throw fetchErr;

  const existingSet = new Set();
  (existingPlanta || []).forEach(r => {
    const pNum = cleanErpCode(r?.data_completa?.pedidoNum ?? r?.pedido_num);
    const cArt = cleanErpCode(r?.data_completa?.codArticulo ?? r?.data_completa?.codigo_item);
    if (pNum && cArt) {
      existingSet.add(`${pNum}_${cArt}`);
    }
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
    const key = `${item.pedido_sin}_${item.codigo_item}`;
    if (existingSet.has(key)) {
      continue; // Ya está en planta: NO sobrescribir área ni estado
    }
    existingSet.add(key);

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
      programador: item.programador,
      nombre_proyecto: item.nombre_proyecto,
      categoria: item.categoria,
      notas: item.notas,
      observaciones_erp: item.observaciones_erp,
      fecha_asigna: item.fecha_asigna,
      fecha_genera_ped: item.fecha_genera_ped,
      data_completa: newOrderObj
    });
  }

  for (let i = 0; i < newPlantaRecords.length; i += chunkSize) {
    const chunk = newPlantaRecords.slice(i, i + chunkSize);
    const { error } = await supabase.from('produccion_pedidos').insert(chunk);
    if (error) throw error;
  }

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
 */
export const importConsultaInventarioRows = async (rows, onProgress, filterGroups = true) => {
  const ALLOWED_GROUPS = ['MATERIAS PRIMAS E INSUMOS', 'HERRAMIENTAS'];

  const filteredRows = filterGroups
    ? rows.filter(row => {
        const grupo = String(row['Grupo'] ?? row['grupo'] ?? '').trim().toUpperCase();
        if (!grupo) return true;
        return ALLOWED_GROUPS.some(g => grupo.includes(g));
      })
    : rows;

  const mappedInventario = [];
  for (const row of filteredRows) {
    const rawIdRef = row['Id Referencia'] ?? row['idreferencia'] ?? row['id_referencia'];
    const idreferencia = rawIdRef !== undefined && rawIdRef !== null && String(rawIdRef).trim() !== ''
      ? (Number.isNaN(Number(rawIdRef)) ? String(rawIdRef).replace(/\.0+$/, '').trim() : String(Math.trunc(Number(rawIdRef))).trim())
      : null;

    if (!idreferencia) continue;

    const referencia = String(row['Referencia'] ?? row['referencia'] ?? '').trim();
    const grupo = String(row['Grupo'] ?? row['grupo'] ?? '').trim();
    const subgrupo = String(row['Subgrupo'] ?? row['subgrupo'] ?? '').trim();
    const linea = String(row['Linea'] ?? row['Línea'] ?? row['linea'] ?? '').trim();
    const ubicacion = String(row['Ubicacion'] ?? row['Ubicación'] ?? row['ubicacion'] ?? '').trim();
    const idunidad = String(row['Id Unidad'] ?? row['idunidad'] ?? '').trim();
    const embalaje = String(row['Embalaje'] ?? row['embalaje'] ?? '').trim();
    const existencia = toSafeNumber(row['Existencia'] ?? row['existencia'] ?? row['Saldo'] ?? 0);

    mappedInventario.push({
      "Id Referencia": idreferencia,
      "Referencia": referencia,
      "Grupo": grupo,
      "Subgrupo": subgrupo,
      "Linea": linea,
      "Ubicacion": ubicacion,
      "Id Unidad": idunidad,
      "Embalaje": embalaje,
      "Saldo": existencia,
      idreferencia,
      referencia,
      grupo,
      subgrupo,
      linea,
      ubicacion,
      idunidad,
      embalaje,
      existencia
    });
  }

  const chunkSize = 500;
  let processed = 0;
  for (let i = 0; i < mappedInventario.length; i += chunkSize) {
    const chunk = mappedInventario.slice(i, i + chunkSize);
    const { error } = await supabase.from('inventario').upsert(chunk, { onConflict: 'idreferencia' });
    if (error) {
      // Fallback insert si no hay constraint único en idreferencia
      const { error: insErr } = await supabase.from('inventario').insert(chunk);
      if (insErr) throw insErr;
    }
    processed += chunk.length;
    if (onProgress) onProgress(Math.round((processed / mappedInventario.length) * 100));
  }

  return { importedCount: mappedInventario.length };
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
