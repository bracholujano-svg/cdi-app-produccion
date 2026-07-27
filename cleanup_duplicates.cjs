const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseAnonKey = envVars['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanup() {
  console.log("Fetching orders to find duplicates...");
  const { data: dbOrders, error } = await supabase.from('produccion_pedidos').select('id, data_completa');
  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }

  console.log(`Fetched ${dbOrders.length} orders from Supabase.`);

  const orders = dbOrders.map(row => row.data_completa);

  // Group by pedidoNum + codArticulo
  const groups = {};
  for (const o of orders) {
    const key = `${o.pedidoNum}-${o.codArticulo}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  }

  const toDelete = [];

  for (const key in groups) {
    if (groups[key].length > 1) {
      const items = groups[key];
      const originals = items.filter(i => !i.master_id);
      const clones = items.filter(i => i.master_id);

      if (originals.length > 0 && clones.length > 0) {
        console.log(`Found ${clones.length} clones for ${key}`);
        for (const clone of clones) {
          toDelete.push(clone.id);
        }
      } else if (items.length > 1 && originals.length > 1) {
        // Just in case there are exact duplicates without master_id
        console.log(`Multiple items for ${key} but no master_id (exact duplicates). Count: ${items.length}`);
        const sorted = items.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        const extras = sorted.slice(1);
        for (const extra of extras) {
          toDelete.push(extra.id);
        }
      }
    }
  }

  console.log(`Found ${toDelete.length} items to delete.`);
  
  if (toDelete.length > 0) {
    console.log("Deleting cloned items...");
    for (const id of toDelete) {
      const { error: delError } = await supabase.from('produccion_pedidos').delete().eq('id', id);
      if (delError) {
        console.error(`Error deleting ${id}:`, delError);
      } else {
        console.log(`Deleted ${id}`);
      }
    }
    console.log("Cleanup complete!");
  } else {
    console.log("No cloned duplicates found.");
  }
}

cleanup();
