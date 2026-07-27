const fs = require('fs');

let code = fs.readFileSync('src/components/orders/ReceptionModal.jsx', 'utf8');

// 1. Update props
code = code.replace(
    'const ReceptionModal = ({ processReception }) => {',
    'const ReceptionModal = ({ processReception, processBulkReception }) => {'
);

// 2. Update State
code = code.replace(
    'const [selectedItem, setSelectedItem] = useState(null);',
    'const [selectedItems, setSelectedItems] = useState([]);'
);

// 3. resetState
code = code.replace(
    'setSelectedItem(null);',
    'setSelectedItems([]);'
);

// 4. Insert toggle logic and replace handlers
const toggle_logic = `
    const toggleItem = (item) => {
        setErrorMsg("");
        if (selectedItems.find(i => i.id === item.id)) {
            setSelectedItems(selectedItems.filter(i => i.id !== item.id));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const toggleGroup = (groupItems) => {
        setErrorMsg("");
        const allSelected = groupItems.every(gi => selectedItems.find(si => si.id === gi.id));
        if (allSelected) {
            setSelectedItems(selectedItems.filter(si => !groupItems.find(gi => gi.id === si.id)));
        } else {
            const newItems = [...selectedItems];
            groupItems.forEach(gi => {
                if (!newItems.find(i => i.id === gi.id)) newItems.push(gi);
            });
            setSelectedItems(newItems);
        }
    };

    const handleCameraClick`;

code = code.replace('    const handleCameraClick', toggle_logic);

// 5. Handlers
code = code.replace(
    /processReception\(selectedItem\.id, true, receptionName, receptionNotes, tempPhoto\);/g,
    'processBulkReception(selectedItems.map(i => i.id), true, receptionName, receptionNotes, tempPhoto);'
);

code = code.replace(
    /processReception\(selectedItem\.id, false, receptionName, receptionNotes, tempPhoto\);/g,
    'processBulkReception(selectedItems.map(i => i.id), false, receptionName, receptionNotes, tempPhoto);'
);

code = code.replace(
    /const updatedOrder = \{ \.\.\.selectedItem, estadoInterno: CONFIG_PROCESOS\[selectedItem\.areaActual\]\?\.\[0\] \|\| "En Espera" \};/g,
    'const target = selectedItems[0];\n        const updatedOrder = { ...target, estadoInterno: CONFIG_PROCESOS[target.areaActual]?.[0] || "En Espera" };'
);

code = code.replace(
    /const newOrdersList = orders\.map\(o => o\.id === selectedItem\.id \? updatedOrder : o\);/g,
    'const newOrdersList = orders.map(o => o.id === target.id ? updatedOrder : o);'
);

// 6. Render Mapping
code = code.replace(
    /onClick=\{\(\) => \{ setSelectedItem\(item\); setErrorMsg\(""\); \}\}/g,
    'onClick={() => toggleItem(item)}'
);

code = code.replace(
    /selectedItem\?\.id === item\.id/g,
    'selectedItems.find(i => i.id === item.id)'
);

code = code.replace(
    /<div className="bg-\[var\(--primary\)\]\/10 px-3 py-2 rounded-lg border border-\[var\(--primary\)\]\/20">/g,
    '<div onClick={() => toggleGroup(pendingGroups[pedidoNum])} className="bg-[var(--primary)]/10 px-3 py-2 rounded-lg border border-[var(--primary)]/20 cursor-pointer hover:bg-[var(--primary)]/20 transition-colors flex justify-between items-center">'
);

code = code.replace(
    /<span className="font-black text-sm text-\[var\(--primary\)\] uppercase">PEDIDO: \{pedidoNum\}<\/span>\n\s*<\/div>/g,
    '<span className="font-black text-sm text-[var(--primary)] uppercase">PEDIDO: {pedidoNum}</span>\n                                            <span className="text-[10px] text-[var(--primary)] font-bold bg-white/10 px-2 py-0.5 rounded shadow-sm border border-[var(--primary)]/20">Seleccionar Grupo</span>\n                                        </div>'
);

// Same for rejected groups
code = code.replace(
    /<div className="bg-red-500\/10 px-3 py-2 rounded-lg border border-red-500\/20">/g,
    '<div onClick={() => toggleGroup(rejectedGroups[pedidoNum])} className="bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors flex justify-between items-center">'
);

code = code.replace(
    /<span className="font-black text-sm text-red-500 uppercase">PEDIDO: \{pedidoNum\}<\/span>\n\s*<\/div>/g,
    '<span className="font-black text-sm text-red-500 uppercase">PEDIDO: {pedidoNum}</span>\n                                            <span className="text-[10px] text-red-500 font-bold bg-white/10 px-2 py-0.5 rounded shadow-sm border border-red-500/20">Seleccionar Grupo</span>\n                                        </div>'
);

// 7. Details View
code = code.replace(
    /selectedItem \?/g,
    'selectedItems.length > 0 ?'
);

code = code.replace(
    /<span className="text-\[var\(--primary\)\]">Enviado por:<\/span> \{selectedItem\.transferenciaPendiente\?\.entregadoPor\}/g,
    '<span className="text-[var(--primary)]">Enviado por:</span> {selectedItems.length === 1 ? selectedItems[0].transferenciaPendiente?.entregadoPor : "MÚLTIPLES (Acción Masiva)"}'
);

code = code.replace(
    /\{selectedItem\.transferenciaPendiente\?\.nota && \(/g,
    '{selectedItems.length === 1 && selectedItems[0].transferenciaPendiente?.nota && ('
);

code = code.replace(
    /"\{selectedItem\.transferenciaPendiente\.nota\}"/g,
    '"{selectedItems[0].transferenciaPendiente?.nota}"'
);

code = code.replace(
    /\{selectedItem\.transferenciaPendiente\?\.fotoEntrega && \(/g,
    '{selectedItems.length === 1 && selectedItems[0].transferenciaPendiente?.fotoEntrega && ('
);

code = code.replace(
    /window\.open\(selectedItem\.transferenciaPendiente\.fotoEntrega\)/g,
    'window.open(selectedItems[0].transferenciaPendiente?.fotoEntrega)'
);

code = code.replace(
    /getRejectionReason\(selectedItem\)/g,
    'getRejectionReason(selectedItems[0])'
);

code = code.replace(
    /<h3 className="font-black text-xs text-gray-500 uppercase mb-2">Datos de Envío<\/h3>/g,
    '{selectedItems.length > 1 && (\n                                            <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 p-3 rounded-xl mb-4">\n                                                <h3 className="font-black text-[var(--accent)] uppercase flex items-center gap-2">\n                                                    <CheckCircle size={16} /> Acción Masiva\n                                                </h3>\n                                                <p className="text-xs font-bold text-[var(--primary)] mt-1">Estás recibiendo {selectedItems.length} productos simultáneamente.</p>\n                                            </div>\n                                        )}\n                                        <h3 className="font-black text-xs text-gray-500 uppercase mb-2">Datos de Envío</h3>'
);

fs.writeFileSync('src/components/orders/ReceptionModal.jsx', code);
console.log("DONE");
