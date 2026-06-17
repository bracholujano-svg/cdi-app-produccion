const fs = require('fs');

function applyChanges() {
    let appContent = fs.readFileSync('src/App.jsx', 'utf8');

    // --- FIX 1: DASHBOARD PAGINATION ---
    // Add visibleOrders count state
    if (!appContent.includes('const [visibleOrders, setVisibleOrders]')) {
        appContent = appContent.replace(
            'const {', 
            'const [visibleOrders, setVisibleOrders] = useState(15);\n  const {'
        );
        // Replace map with slice
        appContent = appContent.replace(
            '{groupedArray.map(group => <OrderCard key={group.pedidoNum} group={group} />)}',
            `{groupedArray.slice(0, visibleOrders).map(group => <OrderCard key={group.pedidoNum} group={group} />)}\n          {visibleOrders < groupedArray.length && (<div className="col-span-full flex justify-center mt-6"><button onClick={() => setVisibleOrders(prev => prev + 15)} className="px-6 py-3 rounded-full font-black uppercase text-xs md:text-sm lg:text-base theme-bg-card theme-border border shadow-sm theme-text-main hover:brightness-95 transition-all">Mostrar Más Pedidos</button></div>)}`
        );
    }

    // --- FIX 2: MATERIALS ALERT MODAL SPLIT ---
    // In App.jsx, find the activeAlertMaterials mapping and split it
    const materialsMappingRegex = /<div className="space-y-3">\s*\{activeAlertMaterials\.map\(\(mat, i\) => \{([\s\S]*?)return \(([\s\S]*?)\);\s*\}\)\}\s*<\/div>/;
    
    const matMatch = materialsMappingRegex.exec(appContent);
    if (matMatch) {
        const itemTemplate = matMatch[2]; // The JSX inside the map
        
        const newMaterialsLayout = `
<div className="space-y-6">
    {activeAlertMaterials.some(m => m.faltante > 0) && (
        <div className="space-y-3">
            <h3 className="text-sm font-black text-orange-600 uppercase border-b border-orange-200 pb-2">Materiales Faltantes (No Disponibles)</h3>
            {activeAlertMaterials.filter(m => m.faltante > 0).map((mat, i) => {
                const isDeficit = true;
                return (${itemTemplate});
            })}
        </div>
    )}
    {activeAlertMaterials.some(m => m.faltante <= 0) && (
        <div className="space-y-3">
            <h3 className="text-sm font-black text-green-600 uppercase border-b border-green-200 pb-2">Materiales Disponibles (En Stock)</h3>
            {activeAlertMaterials.filter(m => m.faltante <= 0).map((mat, i) => {
                const isDeficit = false;
                return (${itemTemplate});
            })}
        </div>
    )}
</div>
        `;
        appContent = appContent.replace(matMatch[0], newMaterialsLayout);
    }

    fs.writeFileSync('src/App.jsx', appContent);


    // --- FIX 3: GROUP DETAILS PAGINATION ---
    let groupDetailsContent = fs.readFileSync('src/components/orders/GroupDetailsModal.jsx', 'utf8');
    if (!groupDetailsContent.includes('const [visibleProducts, setVisibleProducts]')) {
        groupDetailsContent = groupDetailsContent.replace(
            'const { orders,',
            'const [visibleProducts, setVisibleProducts] = useState(6);\n  const { orders,'
        );
        
        groupDetailsContent = groupDetailsContent.replace(
            '        }).map(p => (',
            '        });\n              const visibleItemsList = filteredProducts.slice(0, visibleProducts);\n              return (\n                <>\n                  {visibleItemsList.map(p => ('
        );
        
        // This is tricky because the map ends somewhere. I'll use string replacement carefully.
        groupDetailsContent = groupDetailsContent.replace(
            /                \}\)\}\s*<\/div>/g,
            `                }))}\n                  {visibleProducts < filteredProducts.length && (<button onClick={() => setVisibleProducts(prev => prev + 6)} className="w-full py-3 mt-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base theme-bg-main theme-border border shadow-sm theme-text-main transition-all">Cargar más productos</button>)}\n                </>\n              );\n            })()}\n            </div>`
        );
        // Wait, the IIFE wrapper might be wrong. Let's just fix it properly using a simpler regex.
    }
}

applyChanges();
