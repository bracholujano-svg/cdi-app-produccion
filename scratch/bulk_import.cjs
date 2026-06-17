const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto'); // Para generar UUIDs en el script

const supabaseUrl = 'https://klapeabwtphxqdspiggv.supabase.co';
const supabaseAnonKey = 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const pedidosObjetivo = ['63415', '63309', '63526', '63560', '63383', '63577', '63595', '63557'];

async function bulkImport() {
    console.log("Iniciando Inyección Masiva en produccion_pedidos...");

    // 1. Obtener tracking actual
    const { data: trackingData, error: tErr } = await supabase.from('produccion_pedidos').select('data_completa');
    if (tErr) { console.error("Error leyendo tracking:", tErr); return; }
    
    // Parsear y armar Set para evitar duplicados
    const trackingSet = new Set();
    trackingData.forEach(row => {
        if(row.data_completa && row.data_completa.pedidoNum && row.data_completa.codArticulo) {
            trackingSet.add(`${row.data_completa.pedidoNum}-${row.data_completa.codArticulo}`);
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
        const pNum = item['PedidoSIN'];
        const codArt = item['Código Ítem'];
        
        if (trackingSet.has(`${pNum}-${codArt}`)) {
            continue; // Ya existe, lo saltamos
        }

        const newId = crypto.randomUUID();
        const newItem = {
            id: newId,
            pedidoNum: pNum,
            codArticulo: codArt,
            nombre: item['Descripción'],
            cliente: item['Nombre Proyecto'] || item['Cliente'],
            cantidadRequerida: item['Cantidad'] || 1,
            fechaEntregaPrometida: item['Fecha Entrega'] || null,
            areaActual: "Comercial / Ventas",
            estadoInterno: "Ingreso de Pedido",
            prioridad: "NORMAL",
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
            data_completa: newItem
        });
    }

    if (itemsToInsert.length === 0) {
        console.log("¡Todo está al día! No hay items nuevos que inyectar.");
        return;
    }

    console.log(`Inyectando ${itemsToInsert.length} productos nuevos...`);

    // Insertar en lotes si es muy grande, pero supabase aguanta hasta 1000 sin problema
    const { error: insErr } = await supabase.from('produccion_pedidos').insert(itemsToInsert);
    if (insErr) {
        console.error("Error insertando:", insErr);
    } else {
        console.log("✅ INYECCIÓN MASIVA COMPLETADA EXITOSAMENTE.");
    }
}

bulkImport();
