const fs = require('fs');

function patchApp() {
    const p = 'src/App.jsx';
    let content = fs.readFileSync(p, 'utf8');

    const oldFilterLogic = `    if (viewFilter === 'ATRASADOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0;
    if (viewFilter === 'CUMPLIDOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && (getDaysLeft(o.fechaEntregaPrometida) === null || getDaysLeft(o.fechaEntregaPrometida) >= 0);
    if (viewFilter === 'DESPACHADOS') return matchSearch && matchArea && o.estadoInterno === 'DESPACHADO';`;

    const newFilterLogic = `    if (viewFilter === 'ATRASADOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0;
    if (viewFilter === 'CUMPLIDOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && (getDaysLeft(o.fechaEntregaPrometida) === null || getDaysLeft(o.fechaEntregaPrometida) >= 0);
    if (viewFilter === 'DESPACHADOS') return matchSearch && matchArea && o.estadoInterno === 'DESPACHADO';
    if (viewFilter === 'PENDIENTES_RECEPCION') return matchSearch && matchArea && o.transferenciaPendiente !== undefined;`;

    content = content.replace(oldFilterLogic, newFilterLogic);
    fs.writeFileSync(p, content, 'utf8');
}

function patchHeader() {
    const p = 'src/components/layout/Header.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // 1. Calculate the number of pending receptions across the entire plant (or area)
    const oldCounts = `  const despachadosCount = orders.filter(o => o && o.estadoInterno === 'DESPACHADO').length;
  const atrasadosCount = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0).length;`;

    const newCounts = `  const despachadosCount = orders.filter(o => o && o.estadoInterno === 'DESPACHADO').length;
  const atrasadosCount = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0).length;
  const pendientesCount = orders.filter(o => o && o.transferenciaPendiente !== undefined && (areaFilter === 'Todas' || o.areaActual === areaFilter)).length;`;

    content = content.replace(oldCounts, newCounts);

    // 2. Add the button
    const oldButtons = `              <button type="button" onClick={() => setViewFilter('DESPACHADOS')} className={\`px-4 py-2 rounded-lg text-xs md:text-sm font-black uppercase transition-all \${viewFilter === 'DESPACHADOS' ? 'bg-green-500 text-white shadow-sm' : 'text-green-600 dark:text-green-500/70 hover:text-green-500'}\`}>
                Despachados ({despachadosCount})
              </button>
              <button type="button" className={\`px-4 py-2 rounded-lg text-xs md:text-sm font-black uppercase transition-all theme-text-muted opacity-50 cursor-not-allowed\`}>
                Nuevos Ped. (0)
              </button>`;

    const newButtons = `              <button type="button" onClick={() => setViewFilter('DESPACHADOS')} className={\`px-4 py-2 rounded-lg text-xs md:text-sm font-black uppercase transition-all \${viewFilter === 'DESPACHADOS' ? 'bg-green-500 text-white shadow-sm' : 'text-green-600 dark:text-green-500/70 hover:text-green-500'}\`}>
                Despachados ({despachadosCount})
              </button>
              <button type="button" onClick={() => setViewFilter('PENDIENTES_RECEPCION')} className={\`px-4 py-2 rounded-lg text-xs md:text-sm font-black uppercase transition-all \${viewFilter === 'PENDIENTES_RECEPCION' ? 'bg-yellow-500 text-yellow-950 shadow-sm' : 'text-yellow-600 dark:text-yellow-500/70 hover:text-yellow-500'}\`}>
                Pendientes por Recepción ({pendientesCount})
              </button>`;

    content = content.replace(oldButtons, newButtons);
    fs.writeFileSync(p, content, 'utf8');
}

try {
    patchApp();
    patchHeader();
    console.log("Patched filter successfully.");
} catch(e) {
    console.error(e);
}
