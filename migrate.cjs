const fs = require('fs');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://klapeabwtphxqdspiggv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const runMigration = async () => {
  console.log('Leyendo archivo Excel...');
  const workbook = xlsx.readFile('../app.jsx cdi exhibiciones/registro de pedidos cdi vercion prueba.xlsx');
  
  // 1. Migrar Pedidos (Hoja 1) -> ribisoft_pedidos
  console.log('Migrando Hoja 1 (ribisoft_pedidos)...');
  const hoja1 = xlsx.utils.sheet_to_json(workbook.Sheets['Hoja 1'], { defval: "" });
  const pedidosData = hoja1.map(row => ({
    pedido: String(row['PedidoSIN'] || ''),
    articulo: String(row['Código Ítem'] || ''),
    descripcion: String(row['Descripción'] || ''),
    cliente: String(row['Cliente'] || ''),
    proyecto: String(row['Nombre Proyecto'] || ''),
    cantidad: Number(row['Cantidad'] || 0)
  })).filter(p => p.pedido !== '');

  if (pedidosData.length > 0) {
    const { error } = await supabase.from('ribisoft_pedidos').insert(pedidosData);
    if (error) console.error('Error insertando pedidos:', error);
    else console.log(`✓ ${pedidosData.length} pedidos migrados exitosamente.`);
  }

  // 2. Migrar Inventario (INVENTARIO CDI) -> inventario (YA MIGRADO CON EXITO)
  console.log('Omitiendo Inventario y Requerimientos (ya migrados).');
  console.log('!!! MIGRACIÓN FINALIZADA !!!');
};

runMigration();
