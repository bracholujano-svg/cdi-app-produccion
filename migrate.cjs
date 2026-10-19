const fs = require('fs');
const xlsx = require('xlsx');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://klapeabwtphxqdspiggv.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const cleanCode = (val) => {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const num = Number(val);
  if (!Number.isNaN(num) && Number.isFinite(num)) {
    return String(Math.trunc(num)).trim();
  }
  return String(val).replace(/\.0+$/, '').trim();
};

const isTruthyFlag = (val) => {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const norm = val.trim().toUpperCase();
    return norm === 'TRUE' || norm === 'VERDADERO' || norm === 'SI' || norm === 'SÍ' || norm === '1';
  }
  return false;
};

/**
 * A) Importar MATERIALES REQUERIDOS PARA PEDIDOS.xls en `requerimientos_pedido`
 * y actualizar `existencia` y `ubicacion` en `inventario`.
 */
async function importMaterialesRequeridos(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] No se encontró ${filePath}`);
    return;
  }
  console.log(`Importando ${filePath} en requerimientos_pedido...`);
  const wb = xlsx.readFile(filePath);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

  const mapped = [];
  const inventoryUpdates = new Map();

  for (const row of rows) {
    const pedido_sin = row['pedido_sin'] !== undefined && row['pedido_sin'] !== null
      ? cleanCode(row['pedido_sin'])
      : cleanCode(row['pedidosin'] ?? row['PedidoSIN']);

    if (!pedido_sin) continue;

    // CRÍTICO: En Excel codpt viene como float 33000070.0 -> limpiar obligatoriamente
    const codpt = row['codpt'] ? String(Math.trunc(Number(row['codpt']))).trim() : null;
    const idreferencia = row['idreferencia']
      ? String(Math.trunc(Number(row['idreferencia']))).trim()
      : cleanCode(row['Id Referencia']);

    if (!idreferencia) continue;

    const record = {
      numero_rq: row['numero'] ? String(row['numero']).trim() : null,
      pedido_cot: row['pedido'] ? cleanCode(row['pedido']) : null,
      pedido_sin,
      codpt: codpt && codpt !== 'NaN' ? codpt : null,
      producto: row['producto'] ? String(row['producto']).trim() : null,
      idreferencia,
      referencia: row['referencia'] ? String(row['referencia']).trim() : (row['Descripcion'] ? String(row['Descripcion']).trim() : null),
      idunidad: row['idunidad'] ? String(row['idunidad']).trim() : null,
      fecha_solicitud: row['Fecha Solicitud'] ? String(row['Fecha Solicitud']).trim() : null,
      pedida_reser: Number(row['pedida(reser)'] ?? row['pedida_reser'] ?? row['Cantidad'] ?? 0) || 0,
      cant_oc: Number(row['cant_oc'] ?? row['Cant.OC'] ?? 0) || 0,
      entregada: Number(row['entregada'] ?? 0) || 0,
      pendiente: Number(row['pendiente'] ?? 0) || 0,
      existencia: Number(row['existencia'] ?? 0) || 0,
      ubicacion: row['Ubicación'] ? String(row['Ubicación']).trim() : (row['Ubicacion'] ? String(row['Ubicacion']).trim() : null)
    };

    mapped.push(record);
    inventoryUpdates.set(idreferencia, {
      existencia: record.existencia,
      ubicacion: record.ubicacion
    });
  }

  for (let i = 0; i < mapped.length; i += 500) {
    const chunk = mapped.slice(i, i + 500);
    const { error } = await supabase.from('requerimientos_pedido').insert(chunk);
    if (error) console.error('Error insertando en requerimientos_pedido:', error.message);
  }
  console.log(`✓ ${mapped.length} requerimientos importados en requerimientos_pedido.`);

  for (const [idref, upd] of inventoryUpdates.entries()) {
    const payload = { existencia: upd.existencia };
    if (upd.ubicacion) payload.ubicacion = upd.ubicacion;
    await supabase.from('inventario').update(payload).eq('idreferencia', idref);
  }
  console.log(`✓ ${inventoryUpdates.size} referencias sincronizadas con existencia y ubicación en inventario.`);
}

/**
 * B) Importar `lista de pedidos de produccion.xls` en `ribisoft_pedidos` y `produccion_pedidos`.
 */
async function importPedidosProduccion(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] No se encontró ${filePath}`);
    return;
  }
  console.log(`Importando ${filePath} en ribisoft_pedidos y produccion_pedidos...`);
  const wb = xlsx.readFile(filePath);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

  const activeRows = rows.filter(row => {
    const anulado = isTruthyFlag(row['Anulado'] ?? row['anulado']);
    const descartado = isTruthyFlag(row['Descartado'] ?? row['descartado']);
    return !anulado && !descartado;
  });

  const ribisoftData = [];
  const plantaCandidates = [];

  for (const row of activeRows) {
    const pedido_sin = cleanCode(row['PedidoSIN'] ?? row['pedido_sin'] ?? row['pedidosin']);
    if (!pedido_sin) continue;

    let codigo_item = cleanCode(row['Código Ítem'] ?? row['codigo_item'] ?? row['codpt']);
    if (!codigo_item) {
      const desc = String(row['Descripción'] ?? row['Descripcion'] ?? '');
      const m = desc.match(/\b(33\d{6,})\b/);
      if (m) codigo_item = m[1];
    }

    const commonFields = {
      codigo_item: codigo_item || null,
      dim_1: row['dim_1'] ?? row['Dim 1'] ?? row['Dim1'] ?? null,
      dim_2: row['dim_2'] ?? row['Dim 2'] ?? row['Dim2'] ?? null,
      dim_3: row['dim_3'] ?? row['Dim 3'] ?? row['Dim3'] ?? null,
      acabado_1: row['acabado_1'] ?? row['Acabado 1'] ?? row['Acabado1'] ?? null,
      acabado_2: row['acabado_2'] ?? row['Acabado 2'] ?? row['Acabado2'] ?? null,
      acabado_3: row['acabado_3'] ?? row['Acabado 3'] ?? row['Acabado3'] ?? null,
      caracteristicas: row['caracteristicas'] ?? row['Características'] ?? row['Caracteristicas'] ?? null,
      programador: row['Programador'] ?? row['programador'] ?? null,
      nombre_proyecto: row['Nombre Proyecto'] ?? row['nombre_proyecto'] ?? null,
      categoria: row['categoria'] ?? row['Categoría'] ?? row['Categoria'] ?? null,
      notas: row['notas'] ?? row['Notas'] ?? null,
      observaciones_erp: row['observaciones_erp'] ?? row['Observaciones ERP'] ?? row['Observaciones'] ?? null,
      fecha_asigna: row['fecha_asigna'] ?? row['Fecha Asigna'] ?? null,
      fecha_genera_ped: row['fecha_genera_ped'] ?? row['Fecha Genera Ped'] ?? row['Fecha Genera'] ?? null
    };

    ribisoftData.push({
      "PedidoSIN": pedido_sin,
      "Código Ítem": codigo_item || '',
      "Descripción": String(row['Descripción'] ?? row['Descripcion'] ?? ''),
      "Cliente": String(row['Cliente'] ?? row['Nombre Proyecto'] ?? ''),
      "Nombre Proyecto": String(commonFields.nombre_proyecto || ''),
      "Estado": String(row['Estado'] || ''),
      "Programador": String(commonFields.programador || ''),
      "Cantidad": Number(row['Cantidad'] || 1),
      ...commonFields
    });

    plantaCandidates.push({
      pedido_sin,
      codigo_item: codigo_item || '',
      descripcion: String(row['Descripción'] ?? row['Descripcion'] ?? ''),
      cliente: String(row['Cliente'] ?? row['Nombre Proyecto'] ?? 'N/A'),
      cantidad: Number(row['Cantidad'] || 1),
      fecha_entrega: row['Fecha Entrega'] ?? null,
      ...commonFields
    });
  }

  for (let i = 0; i < ribisoftData.length; i += 500) {
    const chunk = ribisoftData.slice(i, i + 500);
    const { error } = await supabase.from('ribisoft_pedidos').insert(chunk);
    if (error) console.error('Error insertando en ribisoft_pedidos:', error.message);
  }

  // Consultar produccion_pedidos para insertar SOLO productos nuevos (sin sobrescribir área ni estado)
  const { data: existingPlanta } = await supabase.from('produccion_pedidos').select('pedido_num, data_completa');
  const trackingSet = new Set();
  (existingPlanta || []).forEach(r => {
    const pNum = cleanCode(r?.data_completa?.pedidoNum ?? r?.pedido_num);
    const cArt = cleanCode(r?.data_completa?.codArticulo ?? r?.data_completa?.codigo_item);
    if (pNum && cArt) trackingSet.add(`${pNum}-${cArt}`);
  });

  const newPlantaRows = [];
  for (const item of plantaCandidates) {
    const key = `${item.pedido_sin}-${item.codigo_item}`;
    if (trackingSet.has(key)) continue;
    trackingSet.add(key);

    const newId = crypto.randomUUID();
    const data_completa = {
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
      historial: [{
        fecha: new Date().toISOString(),
        accion: 'Creación Automática ERP Ribisoft',
        entrega: 'SISTEMA ERP',
        recibe: 'Diseño'
      }]
    };

    newPlantaRows.push({
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
      data_completa
    });
  }

  for (let i = 0; i < newPlantaRows.length; i += 500) {
    const chunk = newPlantaRows.slice(i, i + 500);
    const { error } = await supabase.from('produccion_pedidos').insert(chunk);
    if (error) console.error('Error insertando nuevos pedidos en produccion_pedidos:', error.message);
  }
  console.log(`✓ ${newPlantaRows.length} productos nuevos insertados en produccion_pedidos (sin sobrescribir productos existentes en planta).`);
}

/**
 * C) Importar `ConsultaInventario MUESTRA 3.xlsx` en `inventario`.
 */
async function importConsultaInventario(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] No se encontró ${filePath}`);
    return;
  }
  console.log(`Importando ${filePath} en inventario...`);
  const wb = xlsx.readFile(filePath);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

  const ALLOWED_GROUPS = ['MATERIAS PRIMAS E INSUMOS', 'HERRAMIENTAS'];
  const filtered = rows.filter(row => {
    const g = String(row['Grupo'] ?? row['grupo'] ?? '').trim().toUpperCase();
    if (!g) return true;
    return ALLOWED_GROUPS.some(ag => g.includes(ag));
  });

  const mapped = [];
  for (const row of filtered) {
    const rawIdRef = row['Id Referencia'] ?? row['idreferencia'];
    const idreferencia = rawIdRef ? String(Math.trunc(Number(rawIdRef))).trim() : null;
    if (!idreferencia || idreferencia === 'NaN') continue;

    mapped.push({
      "Id Referencia": idreferencia,
      "Referencia": String(row['Referencia'] ?? row['referencia'] ?? '').trim(),
      "Grupo": String(row['Grupo'] ?? row['grupo'] ?? '').trim(),
      "Subgrupo": String(row['Subgrupo'] ?? row['subgrupo'] ?? '').trim(),
      "Linea": String(row['Linea'] ?? row['Línea'] ?? row['linea'] ?? '').trim(),
      "Ubicacion": String(row['Ubicacion'] ?? row['Ubicación'] ?? row['ubicacion'] ?? '').trim(),
      "Id Unidad": String(row['Id Unidad'] ?? row['idunidad'] ?? '').trim(),
      "Embalaje": String(row['Embalaje'] ?? row['embalaje'] ?? '').trim(),
      idreferencia,
      referencia: String(row['Referencia'] ?? row['referencia'] ?? '').trim(),
      grupo: String(row['Grupo'] ?? row['grupo'] ?? '').trim(),
      subgrupo: String(row['Subgrupo'] ?? row['subgrupo'] ?? '').trim(),
      linea: String(row['Linea'] ?? row['Línea'] ?? row['linea'] ?? '').trim(),
      ubicacion: String(row['Ubicacion'] ?? row['Ubicación'] ?? row['ubicacion'] ?? '').trim(),
      idunidad: String(row['Id Unidad'] ?? row['idunidad'] ?? '').trim(),
      embalaje: String(row['Embalaje'] ?? row['embalaje'] ?? '').trim()
    });
  }

  for (let i = 0; i < mapped.length; i += 500) {
    const chunk = mapped.slice(i, i + 500);
    const { error } = await supabase.from('inventario').upsert(chunk, { onConflict: 'idreferencia' });
    if (error) {
      await supabase.from('inventario').insert(chunk);
    }
  }
  console.log(`✓ ${mapped.length} ítems importados en inventario (priorizando Materias Primas e insumos y Herramientas).`);
}

const runMigration = async () => {
  await importConsultaInventario('ConsultaInventario MUESTRA 3.xlsx');
  await importMaterialesRequeridos('MATERIALES REQUERIDOS PARA PEDIDOS.xls');
  await importPedidosProduccion('lista de pedidos de produccion.xls');
  console.log('!!! MIGRACIÓN ERP RIBISOFT FINALIZADA !!!');
};

if (require.main === module) {
  runMigration();
}

module.exports = {
  importMaterialesRequeridos,
  importPedidosProduccion,
  importConsultaInventario
};
