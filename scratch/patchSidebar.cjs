const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

if (!code.includes('setShowPlantPlannerModal')) {
    code = code.replace(
        'setShowDossierModal,',
        'setShowDossierModal,\n    setShowPlantPlannerModal,'
    );
    
    // Also import Map from lucide-react if not present
    if (!code.includes('Map,')) {
        code = code.replace('import { Menu,', 'import { Menu, Map,');
    }

    const buttonHtml = `
          <button
            onClick={() => {
              setShowPlantPlannerModal(true);
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800 transition-colors theme-text-primary hover:text-white"
          >
            <Map className="w-5 h-5 text-indigo-400" />
            <span className="font-medium">Planificador de Planta</span>
          </button>
`;
    code = code.replace('className="flex-1 overflow-y-auto py-4">', 'className="flex-1 overflow-y-auto py-4">\n' + buttonHtml);
    fs.writeFileSync('src/components/layout/Sidebar.jsx', code);
}
