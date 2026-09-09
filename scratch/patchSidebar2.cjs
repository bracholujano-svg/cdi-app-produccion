const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

const buttonHtml = `
            <button title="Mapa Planta" type="button" onClick={() => { setIsSidebarOpen(false); setShowPlantPlannerModal(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1.5 shadow-lg text-indigo-500 border border-indigo-500/30 transition-colors duration-200 hover:text-white hover:bg-indigo-600 hover:border-indigo-600 hover:-translate-y-1">
              <Map size={"1.8em"} /><span className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-center leading-tight truncate w-full px-1">Mapa Planta</span>
            </button>`;

if (!code.includes('setShowPlantPlannerModal(true)')) {
    code = code.replace(
        '<div className="mt-12 flex flex-col gap-4 w-full px-2 mb-10">',
        '<div className="mt-12 flex flex-col gap-4 w-full px-2 mb-10">\n' + buttonHtml
    );
    fs.writeFileSync('src/components/layout/Sidebar.jsx', code);
}
