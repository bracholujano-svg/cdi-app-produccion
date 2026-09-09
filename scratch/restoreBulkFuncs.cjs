const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

const funcsToInsert = `
  const handleBulkShiftNote = (ids, isTerminadoFlag = null) => {
      if (!ids || ids.length === 0) return;
      let newOrdersList = [...orders];
      const newNoteBase = { 
        supervisor: supervisorProfile?.name || "S/N", operario: tempOperario || "S/N", 
        actividad: tempShiftActivity, nota: shiftNoteText || "Sin novedades", foto: tempPhoto, fecha: new Date().toISOString() 
      };

      ids.forEach((id, index) => {
          const order = newOrdersList.find(o => o?.id === id);
          if(order) {
            const newNote = { ...newNoteBase, area: order.areaActual, id: Date.now() + index };
            const updatedOrder = { ...order, estadoInterno: tempShiftActivity, bitacoraTurnos: [...(order.bitacoraTurnos || []), newNote] };
            if (typeof isTerminadoFlag === 'boolean') {
              updatedOrder.isTerminado = isTerminadoFlag;
            }
            newOrdersList = newOrdersList.map(o => o?.id === id ? updatedOrder : o);
            syncOrderToSupabase(updatedOrder);
          }
      });
      setOrders(newOrdersList);
      setShiftNoteText(""); setTempPhoto(null);
      setShowBulkModal(false);
      setSelectedBulkOrders([]);
  };

  const handleBulkQualityNote = (ids) => {
      if (!ids || ids.length === 0) return;
      let newOrdersList = [...orders];
      const newNoteBase = {
        supervisor: supervisorProfile?.name || "S/N", inspector: calidadInspector || "S/N",
        estado: calidadState, observacion: calidadNota || "Sin observaciones", foto: calidadPhoto, fecha: new Date().toISOString()
      };

      ids.forEach((id, index) => {
          const order = newOrdersList.find(o => o?.id === id);
          if(order) {
            const newNote = { ...newNoteBase, id: Date.now() + index };
            const updatedOrder = { ...order, bitacoraCalidad: [...(order.bitacoraCalidad || []), newNote] };
            newOrdersList = newOrdersList.map(o => o?.id === id ? updatedOrder : o);
            syncOrderToSupabase(updatedOrder);
          }
      });
      setOrders(newOrdersList);
      setCalidadNota(""); setCalidadPhoto(null);
      setShowBulkModal(false);
      setSelectedBulkOrders([]);
  };
`;

const pivot = 'const updateTransfer = async (id, areas) => {';
app = app.replace(pivot, funcsToInsert + '\n  ' + pivot);

fs.writeFileSync('src/App.jsx', app);
