const fs = require('fs');

function patchDashboard() {
    const p = 'src/components/modals/AdvancedExecutiveDashboard.jsx';
    let content = fs.readFileSync(p, 'utf8');
    
    // Remove logistica from tabs
    content = content.replace(
        "['resumen', 'operaciones', 'logistica', 'calidad', 'analitica-ia'].map",
        "['resumen', 'operaciones', 'calidad', 'analitica-ia'].map"
    );
    // Remove the logistica section
    // We'll just remove the tab array item, the section itself won't render if it's not in the array, 
    // but let's be clean, the user can't click it anyway.

    fs.writeFileSync(p, content, 'utf8');
}

function patchIA() {
    const p = 'src/components/modals/InformeInteligenteIA.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Add props
    content = content.replace(
        "const InformeInteligenteIA = ({ orders, onClose, setSearchTerm }) => {",
        "const InformeInteligenteIA = ({ orders, onClose, setSearchTerm, setSelectedGroupPedido, setSelectedOrder, setShowDashboardModal }) => {"
    );

    // Update Deep Linking Handler
    content = content.replace(
        "    const handleDeepLink = (pedidoNum) => {\n        if (setSearchTerm && onClose) {\n            setSearchTerm(String(pedidoNum));\n            onClose();\n        }\n    };",
        `    const handleDeepLink = (pedidoNum) => {
        if (setSelectedGroupPedido && setShowDashboardModal) {
            setSelectedGroupPedido(String(pedidoNum));
            setShowDashboardModal(false);
        }
    };

    const handleProductDeepLink = (pedidoNum, articulo) => {
        if (setSelectedOrder && setShowDashboardModal) {
            // Buscamos el producto exacto
            const product = orders.find(o => String(o.pedidoNum) === String(pedidoNum) && String(o.codArticulo) === String(articulo));
            if (product) {
                setSelectedOrder(product);
                setShowDashboardModal(false);
            }
        }
    };`
    );

    // Update clicks in JSX
    // For Calidad Crítica Agrupada (which was using handleDeepLink(grupo.pedido))
    // We need to change the inner map to use handleProductDeepLink
    content = content.replace(
        "onClick={() => handleDeepLink(grupo.pedido)} className=\"bg-white p-4",
        "className=\"bg-white p-4" // Remove click from the group container
    );
    
    content = content.replace(
        "<div key={i} className=\"text-xs bg-slate-50 p-2 rounded-lg border border-slate-100\">",
        "<div key={i} onClick={() => handleProductDeepLink(grupo.pedido, f.articulo)} className=\"text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-yellow-100 transition-colors\">"
    );

    fs.writeFileSync(p, content, 'utf8');
}

function patchGroupDetails() {
    const p = 'src/components/orders/GroupDetailsModal.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Ensure setShowDashboardModal is in context
    if (!content.includes('setShowDashboardModal')) {
        content = content.replace(
            "const { setSelectedGroupPedido,",
            "const { setShowDashboardModal, setSelectedGroupPedido,"
        );
    }

    // Add button
    content = content.replace(
        "<button type=\"button\" onClick={() => setSelectedGroupPedido(null)} className=\"p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors text-[var(--primary)] shrink-0\">✕</button>",
        `<button type="button" onClick={() => { setSelectedGroupPedido(null); setShowDashboardModal(true); }} className="px-3 py-2 bg-[var(--primary)]/10 rounded-xl hover:bg-[var(--primary)]/20 transition-colors text-[var(--primary)] text-xs font-bold mr-2">⬅ Panel IA</button>
              <button type="button" onClick={() => setSelectedGroupPedido(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors text-[var(--primary)] shrink-0">✕</button>`
    );

    fs.writeFileSync(p, content, 'utf8');
}

function patchOrderDetails() {
    const p = 'src/components/orders/OrderDetailsModal.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Ensure setShowDashboardModal is in context
    if (!content.includes('setShowDashboardModal')) {
        content = content.replace(
            "const {\n    selectedOrder, setSelectedOrder,",
            "const {\n    showDashboardModal, setShowDashboardModal,\n    selectedOrder, setSelectedOrder,"
        );
    }

    // Add button (need to find the close button in the header)
    // Actually, in OrderDetailsModal the header might be different. Let's just insert it before the close button if we can find it.
    // I will write a regex to find the close button X
    content = content.replace(
        "<button type=\"button\" onClick={() => setSelectedOrder(null)}",
        `<button type="button" onClick={() => { setSelectedOrder(null); setShowDashboardModal(true); }} className="px-3 py-2 bg-[var(--primary)]/10 rounded-xl hover:bg-[var(--primary)]/20 transition-colors text-[var(--primary)] text-xs font-bold mr-2">⬅ Panel IA</button>\n              <button type="button" onClick={() => setSelectedOrder(null)}`
    );

    fs.writeFileSync(p, content, 'utf8');
}

function patchDashboardProps() {
    const p = 'src/components/modals/AdvancedExecutiveDashboard.jsx';
    let content = fs.readFileSync(p, 'utf8');
    
    // Pass the new props from context
    content = content.replace(
        "const { setSearchTerm } = useAppContext();",
        "const { setSearchTerm, setSelectedGroupPedido, setSelectedOrder, setShowDashboardModal } = useAppContext();"
    );

    content = content.replace(
        "<InformeInteligenteIA orders={orders} onClose={onClose} setSearchTerm={setSearchTerm} />",
        "<InformeInteligenteIA orders={orders} onClose={onClose} setSearchTerm={setSearchTerm} setSelectedGroupPedido={setSelectedGroupPedido} setSelectedOrder={setSelectedOrder} setShowDashboardModal={setShowDashboardModal} />"
    );

    fs.writeFileSync(p, content, 'utf8');
}


try {
    patchDashboard();
    patchDashboardProps();
    patchIA();
    patchGroupDetails();
    patchOrderDetails();
    console.log("All deep linking patches applied successfully.");
} catch (e) {
    console.error(e);
}
