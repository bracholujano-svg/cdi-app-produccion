const fs = require('fs');

const path = 'c:/Users/Usuario/Documents/cdi-app/src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the states and add the useEffect + helpers
const oldStates = `  const [orders, setOrders] = useState(() => {
    const saved = safeStorage.get('cdi_local_orders');
    try { 
      const parsed = saved ? JSON.parse(saved) : []; 
      return Array.isArray(parsed) ? parsed.filter(o => o && typeof o === 'object') : [];
    } catch(e) { return []; }
  });
  
  const [coordinationAlerts, setCoordinationAlerts] = useState(() => {
    const saved = safeStorage.get('cdi_local_alerts');
    try { 
      const parsed = saved ? JSON.parse(saved) : []; 
      return Array.isArray(parsed) ? parsed.filter(a => a && typeof a === 'object') : [];
    } catch(e) { return []; }
  });`;

const newStates = `  const [orders, setOrders] = useState([]);
  const [coordinationAlerts, setCoordinationAlerts] = useState([]);

  const syncOrderToSupabase = async (orderObject, isDelete = false) => {
    if (!orderObject || !orderObject.id) return;
    try {
      if (isDelete) {
        await supabase.from('produccion_pedidos').delete().eq('id', orderObject.id);
      } else {
        await supabase.from('produccion_pedidos').upsert({
          id: orderObject.id,
          pedido_num: orderObject.pedidoNum || '',
          cliente: orderObject.cliente || '',
          data_completa: orderObject
        });
      }
    } catch (e) { console.error("Error sincronizando orden", e); }
  };

  const syncAlertToSupabase = async (alertObject, isDelete = false) => {
    if (!alertObject || !alertObject.id) return;
    try {
      if (isDelete) {
        await supabase.from('coordinacion_alertas').delete().eq('id', alertObject.id);
      } else {
        await supabase.from('coordinacion_alertas').upsert({
          id: alertObject.id,
          data_completa: alertObject
        });
      }
    } catch (e) { console.error("Error sincronizando alerta", e); }
  };

  useEffect(() => {
    const fetchProduccion = async () => {
      try {
        const { data: pedidosData } = await supabase.from('produccion_pedidos').select('data_completa');
        if (pedidosData) setOrders(pedidosData.map(row => row.data_completa));
        
        const { data: alertasData } = await supabase.from('coordinacion_alertas').select('data_completa');
        if (alertasData) setCoordinationAlerts(alertasData.map(row => row.data_completa));
      } catch (err) {}
    };
    fetchProduccion();

    const subPedidos = supabase.channel('pedidos-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produccion_pedidos' }, fetchProduccion).subscribe();
      
    const subAlertas = supabase.channel('alertas-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinacion_alertas' }, fetchProduccion).subscribe();

    return () => {
      supabase.removeChannel(subPedidos);
      supabase.removeChannel(subAlertas);
    };
  }, []);`;

content = content.replace(oldStates, newStates);

// Replace exact lines for deletions and updates
content = content.replace(
  `setCoordinationAlerts(newAlerts);\n      safeStorage.set('cdi_local_alerts', JSON.stringify(newAlerts));`,
  `setCoordinationAlerts(newAlerts);\n      syncAlertToSupabase({id: alertId}, true);`
);

content = content.replace(
  `setCoordinationAlerts(updatedAlerts);\n      safeStorage.set('cdi_local_alerts', JSON.stringify(updatedAlerts));`,
  `setCoordinationAlerts(updatedAlerts);\n      syncAlertToSupabase(updatedAlerts.find(a => a.id === alertId));`
);

content = content.replace(
  `setOrders(updatedOrders);\n          safeStorage.set('cdi_local_orders', JSON.stringify(updatedOrders));`,
  `setOrders(updatedOrders);\n          syncOrderToSupabase({id: orderId}, true);`
);

content = content.replace(
  `setOrders(newOrdersList); \n    safeStorage.set('cdi_local_orders', JSON.stringify(newOrdersList));`,
  `setOrders(newOrdersList); \n    syncOrderToSupabase(newOrder);`
);

content = content.replace(
  `setOrders(newOrdersList); setSelectedOrder(updatedOrder); safeStorage.set('cdi_local_orders', JSON.stringify(newOrdersList));`,
  `setOrders(newOrdersList); setSelectedOrder(updatedOrder); syncOrderToSupabase(updatedOrder);`
);

content = content.replace(
  `setOrders(newOrdersList); setSelectedOrder(null); safeStorage.set('cdi_local_orders', JSON.stringify(newOrdersList));`,
  `setOrders(newOrdersList); setSelectedOrder(null); syncOrderToSupabase(updatedOrder);`
);

content = content.replace(
  `setCoordinationAlerts(newAlerts);\n                safeStorage.set('cdi_local_alerts', JSON.stringify(newAlerts));`,
  `setCoordinationAlerts(newAlerts);\n                syncAlertToSupabase({id: alertObj.id}, true);`
);

content = content.replace(
  `setCoordinationAlerts(newAlerts); safeStorage.set('cdi_local_alerts', JSON.stringify(newAlerts));`,
  `setCoordinationAlerts(newAlerts); coordList.forEach(a => syncAlertToSupabase(a));`
);

content = content.replace(
  `setOrders(updatedOrders); safeStorage.set('cdi_local_orders', JSON.stringify(updatedOrders));`,
  `setOrders(updatedOrders); updatedOrders.filter(o => coordList.some(c => c.pedidoNum === o.pedidoNum)).forEach(o => syncOrderToSupabase(o));`
);

// add useEffect import
if (!content.includes('useEffect')) {
  content = content.replace('import React, { useState', 'import React, { useState, useEffect');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Modificaciones exitosas!');
