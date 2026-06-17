const fs = require('fs');
const path = require('path');

const appFilePath = path.join(__dirname, '..', 'src', 'App.jsx');
let appContent = fs.readFileSync(appFilePath, 'utf-8');

// 1. Agregar el state de materialsSearchTerm
const stateRegex = /showMaterialsAlertModal, setShowMaterialsAlertModal,/;
if (!appContent.includes('materialsSearchTerm, setMaterialsSearchTerm')) {
    appContent = appContent.replace(stateRegex, "showMaterialsAlertModal, setShowMaterialsAlertModal,\n      materialsSearchTerm, setMaterialsSearchTerm,");
}

const mainAppTopRegex = /function MainApp\(\) \{\n  const \{/;
if (!appContent.includes('const [materialsSearchTerm, setMaterialsSearchTerm] = useState("");')) {
    appContent = appContent.replace(
        mainAppTopRegex, 
        `function MainApp() {\n  const [materialsSearchTerm, setMaterialsSearchTerm] = useState("");\n  const {`
    );
}

// 2. Filtrar materiales y agregar input en el modal
const modalHeaderRegex = /const isModalAlert = activeAlertMaterials\.some\(m => m\.faltante > 0\);/;
const replacementModalState = `const isModalAlert = activeAlertMaterials.some(m => m.faltante > 0);
              const filteredMaterials = activeAlertMaterials.filter(m => !materialsSearchTerm || (m.descripcion && m.descripcion.toLowerCase().includes(materialsSearchTerm.toLowerCase())));
              const withoutStock = filteredMaterials.filter(m => m.faltante > 0).sort((a, b) => (b.sinOC === true ? 1 : 0) - (a.sinOC === true ? 1 : 0));
              const withStock = filteredMaterials.filter(m => m.faltante <= 0);`;

if (!appContent.includes('const filteredMaterials =')) {
    appContent = appContent.replace(
        /const isModalAlert = activeAlertMaterials\.some\(m => m\.faltante > 0\);\s*const withoutStock = activeAlertMaterials\.filter\(m => m\.faltante > 0\)\.sort\(\(a, b\) => \(b\.sinOC === true \? \n?1 : 0\) - \(a\.sinOC === true \? 1 : 0\)\);\s*const withStock = activeAlertMaterials\.filter\(m => m\.faltante <= 0\);/m,
        replacementModalState
    );
}

const modalHeaderUIToReplace = `                          <p className="text-xs font-bold text-slate-500 uppercase mt-1">
                              {isModalAlert ? 'Existen materiales que no cuentan con stock suficiente para cubrir este pedido.' : 'Este pedido cuenta con cobertura total de inventario para su ejecución.'}
                          </p>
                      </div>
                      <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className={\`p-2.5 rounded-xl transition-colors shrink-0 \${isModalAlert ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600' : 'bg-green-500/10 hover:bg-green-500/20 text-[var(--accent)]'}\`}>✕</button>
                    </div>`;

const newModalHeaderUI = `                          <p className="text-xs font-bold text-slate-500 uppercase mt-1">
                              {isModalAlert ? 'Existen materiales que no cuentan con stock suficiente para cubrir este pedido.' : 'Este pedido cuenta con cobertura total de inventario para su ejecución.'}
                          </p>
                      </div>
                      <div className="flex gap-4 items-center">
                          <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={"1.2em"} />
                              <input type="text" placeholder="Buscar material (ej. fórmica)..." className="w-64 pl-9 pr-3 py-2 rounded-lg bg-black/20 border border-slate-700 font-bold text-xs md:text-sm uppercase text-slate-200 outline-none focus:border-blue-500" value={materialsSearchTerm} onChange={(e) => setMaterialsSearchTerm(e.target.value)} />
                          </div>
                          <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className={\`p-2.5 rounded-xl transition-colors shrink-0 \${isModalAlert ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600' : 'bg-green-500/10 hover:bg-green-500/20 text-[var(--accent)]'}\`}>✕</button>
                      </div>
                    </div>`;

if (appContent.includes('<p className="text-xs font-bold text-slate-500 uppercase mt-1">')) {
    appContent = appContent.replace(modalHeaderUIToReplace, newModalHeaderUI);
}

fs.writeFileSync(appFilePath, appContent, 'utf-8');
console.log('App.jsx modal search term añadido.');
