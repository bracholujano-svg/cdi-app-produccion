const fs = require('fs');

function applyAdditionalFixes() {
    // FIX COORDINATION MODAL
    let coordContent = fs.readFileSync('src/components/orders/CoordinationModal.jsx', 'utf8');
    
    // Add orders to useAppContext destructuring
    coordContent = coordContent.replace(
        'const { showCoordinationModal',
        'const { orders, showCoordinationModal'
    );

    // Inject datalist after the h3 inside the form area
    const datalistInjection = `
                <datalist id="clientesList">
                  {Array.from(new Set((orders || []).map(o => o?.cliente).filter(Boolean))).sort().map(cliente => (
                    <option key={cliente} value={cliente} />
                  ))}
                </datalist>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">`;
    
    coordContent = coordContent.replace(
        '<div className="grid grid-cols-1 md:grid-cols-3 gap-3">',
        datalistInjection
    );

    // Add list attribute to the input
    coordContent = coordContent.replace(
        'onChange={e=>setInputManualCliente(e.target.value)} placeholder="CLIENTE / MARCA"',
        'list="clientesList" onChange={e=>setInputManualCliente(e.target.value)} placeholder="CLIENTE / MARCA"'
    );

    fs.writeFileSync('src/components/orders/CoordinationModal.jsx', coordContent);

    // FIX GROUP DETAILS MODAL PAGINATION
    let groupContent = fs.readFileSync('src/components/orders/GroupDetailsModal.jsx', 'utf8');
    
    if (!groupContent.includes('const [visibleProducts, setVisibleProducts]')) {
        groupContent = groupContent.replace(
            'const { orders,',
            'const [visibleProducts, setVisibleProducts] = React.useState(6);\n  const { orders,'
        );
        
        // This part needs careful slicing.
        // Look for: filteredProducts.sort((a,b) => ...).map(p => (
        const mapRegex = /(filteredProducts\.sort\([\s\S]*?\))\.map\(p => \(/;
        const mapMatch = mapRegex.exec(groupContent);
        
        if (mapMatch) {
            const arraySource = mapMatch[1];
            groupContent = groupContent.replace(
                mapRegex,
                `(() => {\n              const sortedArray = ${arraySource};\n              const visibleItemsList = sortedArray.slice(0, visibleProducts);\n              return (\n                <>\n                  {visibleItemsList.map(p => (`
            );
            
            // Now we need to close the IIFE where the map ends.
            // Search for: ))} </div> </div> <div className="p-4 bg-black/5
            groupContent = groupContent.replace(
                /                \}\)\}\n              <\/div>\n            <\/div>\n            <div className="p-4 bg-black\/5/g,
                `                }))}\n                  {visibleProducts < sortedArray.length && (<button onClick={() => setVisibleProducts(prev => prev + 6)} className="w-full py-3 mt-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base theme-bg-main theme-border border shadow-sm theme-text-main transition-all mb-4">Cargar más productos</button>)}\n                </>\n              );\n            })()}\n              </div>\n            </div>\n            <div className="p-4 bg-black/5`
            );
        }

        fs.writeFileSync('src/components/orders/GroupDetailsModal.jsx', groupContent);
    }
}

applyAdditionalFixes();
