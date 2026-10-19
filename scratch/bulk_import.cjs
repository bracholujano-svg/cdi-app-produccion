const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://klapeabwtphxqdspiggv.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const pedidosObjetivo = ['63415', '63309', '63526', '63560', '63383', '63577', '63595', '63557'];

const cleanCode = (val) => {
    if (val === undefined || val === null || String(val).trim() === '') return '';
    const num = Number(val);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
        return String(Math.trunc(num)).trim();
    }
    return String(val).replace(/\.0+$/, '').trim();
};

async function bulkImport() {
    console.log("Iniciando Inyección Masiva en produccion_pedidos...");

    // 1. Obtener tracking actual para NO sobrescribir productos que ya están en planta
    const { data: trackingData, error: tErr } = await supabase.from('produccion_pedidos').select('pedido_num, codigo_item, data_completa');
    if (tErr) { console.error("Error leyendo tracking:", tErr); return; }
    
    const trackingSet = new Set();
    trackingData.forEach(row => {
        const pNum = cleanCode(row?.data_completa?.pedidoNum ?? row?.pedido_num);
        const cArt = cleanCode(row?.data_completa?.codArticulo ?? row?.codigo_item);
        if (pNum && cArt) {
            trackingSet.add(`${pNum}-${cArt}`);
        }
    });
    console.log(`Tenemos ${trackingSet.size} items actualmente en produccion_pedidos.`);

    // 2. Obtener ribisoft
    const { data: ribisoftData, error: rErr } = await supabase
        .from('ribisoft_pedidos')
        .select('*')
        .in('PedidoSIN', pedidosObjetivo);
        
    if (rErr) { console.error("Error leyendo ribisoft:", rErr); return; }
    console.log(`Se encontraron ${ribisoftData.length} items en ribisoft_pedidos para estos ${pedidosObjetivo.length} pedidos.`);

    const itemsToInsert = [];

    for (const item of ribisoftData) {
        if (item['Anulado'] === true || item['Descartado'] === true || item['anulado'] === true || item['descartado'] === true) {
            continue;
        }

        const pNum = cleanCode(item['PedidoSIN'] ?? item['pedido_sin']);
        const codArt = cleanCode(item['codigo_item'] ?? item['Código Ítem']);
        
        if (trackingSet.has(`${pNum}-${codArt}`)) {
            continue; // Ya existe en planta: NO sobrescribir área ni estado
        }
        trackingSet.add(`${pNum}-${codArt}`);

        const newId = crypto.randomUUID();
        const newItem = {
            id: newId,
            pedidoNum: pNum,
            codArticulo: codArt,
            codigo_item: codArt,
            nombre: item['Descripción'] ?? item['descripcion'],
            cliente: item['Nombre Proyecto'] || item['Cliente'] || item['nombre_proyecto'],
            cantidad: item['Cantidad'] || 1,
            cantidadRequerida: item['Cantidad'] || 1,
            fechaEntregaPrometida: item['Fecha Entrega'] || null,
            areaActual: "Comercial / Ventas",
            estadoInterno: "Ingreso de Pedido",
            prioridad: "NORMAL",
            dim_1: item['dim_1'] ?? null,
            dim_2: item['dim_2'] ?? null,
            dim_3: item['dim_3'] ?? null,
            acabado_1: item['acabado_1'] ?? null,
            acabado_2: item['acabado_2'] ?? null,
            acabado_3: item['acabado_3'] ?? null,
            caracteristicas: item['caracteristicas'] ?? null,
            programador: item['programador'] ?? item['Programador'] ?? null,
            nombre_proyecto: item['nombre_proyecto'] ?? item['Nombre Proyecto'] ?? null,
            categoria: item['categoria'] ?? null,
            notas: item['notas'] ?? null,
            observaciones_erp: item['observaciones_erp'] ?? null,
            fecha_asigna: item['fecha_asigna'] ?? null,
            fecha_genera_ped: item['fecha_genera_ped'] ?? null,
            fechaIngresoArea: new Date().toISOString(),
            bitacoraTurnos: [],
            bitacoraCalidad: [],
            historial: [{
                fecha: new Date().toISOString(),
                accion: "Creación Automática Inicial Masiva",
                entrega: "SISTEMA",
                recibe: "COMERCIAL / VENTAS"
            }]
        };

        itemsToInsert.push({
            id: newId,
            pedido_num: pNum,
            cliente: item['Nombre Proyecto'] || item['Cliente'] || 'N/A',
            codigo_item: codArt || null,
            dim_1: item['dim_1'] ?? null,
            dim_2: item['dim_2'] ?? null,
            dim_3: item['dim_3'] ?? null,
            acabado_1: item['acabado_1'] ?? null,
            acabado_2: item['acabado_2'] ?? null,
            acabado_3: item['acabado_3'] ?? null,
            caracteristicas: item['caracteristicas'] ?? null,
            programador: item['programador'] ?? item['Programador'] ?? null,
            nombre_proyecto: item['nombre_proyecto'] ?? item['Nombre Proyecto'] ?? null,
            categoria: item['categoria'] ?? null,
            notas: item['notas'] ?? null,
            observaciones_erp: item['observaciones_erp'] ?? null,
            fecha_asigna: item['fecha_asigna'] ?? null,
            fecha_genera_ped: item['fecha_genera_ped'] ?? null,
            data_completa: newItem
        });
    }

    if (itemsToInsert.length === 0) {
        console.log("¡Todo está al día! No hay items nuevos que inyectar.");
        return;
    }

    console.log(`Inyectando ${itemsToInsert.length} productos nuevos...`);

    const { error: insErr } = await supabase.from('produccion_pedidos').insert(itemsToInsert);
    if (insErr) {
        console.error("Error insertando:", insErr);
    } else {
        console.log("✅ INYECCIÓN MASIVA COMPLETADA EXITOSAMENTE.");
    }
}

bulkImport();
