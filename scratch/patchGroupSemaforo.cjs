const fs = require('fs');
let code = fs.readFileSync('src/components/orders/GroupDetailsModal.jsx', 'utf8');

// The logic inside paginatedProducts.map is:
// const isPartial = ...
// const partialEvents = ...
// const lastPartial = ...
// return (
// <div key={p.id} ... className={`... ${
//   selectedBulkOrders...
//     ? 'border-[var(--color-primary)]...'
//     : p.isTerminado
//       ? 'border-green-500...'
//       : isPartial
//         ? 'border-yellow-400...'
//         : 'theme-border ...'
// }`

// Let's replace the whole paginatedProducts.map block to include the new logic.
const regex = /paginatedProducts\.map\(p => \{([\s\S]*?)return \(\s*<div key=\{p\.id\} onClick=\{[\s\S]*?className=\{`([^`]*?)`\}>/g;

code = code.replace(regex, (match, beforeReturn, classContent) => {
    // Modify beforeReturn to add the `enProceso` variable
    const modifiedBeforeReturn = beforeReturn + `
                  const enProceso = p.bitacoraTurnos && p.bitacoraTurnos.length > 0;
                  const isSemaforoTerminado = p.isTerminado;
                  const isSemaforoEnProceso = !isSemaforoTerminado && enProceso;
                  const isSemaforoEnEspera = !isSemaforoTerminado && !enProceso;
`;

    // Now modify the className interpolation
    const newClassContent = `theme-bg-card p-4 rounded-2xl border-[3px] cursor-pointer transition-colors active:scale-95 bg-[var(--color-surface)] relative flex flex-col justify-between \${
                    selectedBulkOrders.some(o => o.id === p.id) 
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                      : isSemaforoTerminado
                        ? 'border-green-500 dark:border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] bg-green-500/10 hover:border-green-400'
                        : isSemaforoEnProceso 
                          ? 'border-yellow-400 dark:border-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.4)] bg-yellow-400/10 hover:border-yellow-300' 
                          : isSemaforoEnEspera
                            ? 'border-red-400 dark:border-red-500 shadow-[0_0_15px_rgba(248,113,113,0.4)] bg-red-400/5 hover:border-red-300'
                            : 'theme-border shadow-sm hover:border-[var(--color-primary)]'
                  }`;

    return `paginatedProducts.map(p => {${modifiedBeforeReturn}                  return (\n                  <div key={p.id} onClick={() => setSelectedOrder(p)} className={\`${newClassContent}\`}>`;
});

fs.writeFileSync('src/components/orders/GroupDetailsModal.jsx', code);
