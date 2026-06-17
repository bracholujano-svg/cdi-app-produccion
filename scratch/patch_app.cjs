const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Añadir currentPage, setCurrentPage al destructuring del context
content = content.replace(
  /searchTerm, setSearchTerm,\s*areaFilter, setAreaFilter,\s*viewFilter, setViewFilter,\s*gridColumns, setGridColumns,/g,
  `searchTerm, setSearchTerm,
      areaFilter, setAreaFilter,
      viewFilter, setViewFilter,
      currentPage, setCurrentPage,
      gridColumns, setGridColumns,`
);

// 2. Añadir el useEffect para resetear la página al cambiar filtros
const useEffectSpeech = `useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;`;

const useEffectReset = `useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, areaFilter, viewFilter, setCurrentPage]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;`;

content = content.replace(useEffectSpeech, useEffectReset);

// 3. Modificar el renderizado de la grilla
const oldGridBlock = `{groupedArray.map(group => <OrderCard key={group.pedidoNum} group={group} />)}
            {groupedArray.length === 0 && (
              <div className="col-span-full text-center py-20 theme-text-muted">
                <Package size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-black uppercase tracking-widest opacity-50">No hay pedidos en esta vista</p>
              </div>
            )}`;

const newGridBlock = `
            {(() => {
              const itemsPerPage = 24;
              const totalPages = Math.ceil(groupedArray.length / itemsPerPage);
              const paginatedGroups = groupedArray.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
              
              if (groupedArray.length === 0) {
                return (
                  <div className="col-span-full text-center py-20 theme-text-muted">
                    <Package size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-black uppercase tracking-widest opacity-50">No hay pedidos en esta vista</p>
                  </div>
                );
              }

              return (
                <>
                  {paginatedGroups.map(group => <OrderCard key={group.pedidoNum} group={group} />)}
                  
                  {totalPages > 1 && (
                    <div className="col-span-full flex flex-col md:flex-row items-center justify-between mt-8 p-4 bg-black/10 rounded-2xl border theme-border">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-4 py-2 rounded-xl bg-black/20 text-[var(--primary)] font-black uppercase text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--primary)] hover:text-[var(--bg-main)] transition-all"
                        >
                          Anterior
                        </button>
                        <button 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-4 py-2 rounded-xl bg-black/20 text-[var(--primary)] font-black uppercase text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--primary)] hover:text-[var(--bg-main)] transition-all"
                        >
                          Siguiente
                        </button>
                      </div>
                      <div className="mt-4 md:mt-0 font-bold text-[var(--primary)]/70 uppercase text-sm">
                        Página {currentPage} de {totalPages} <span className="mx-2 opacity-50">|</span> {groupedArray.length} Pedidos Totales
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
`;

content = content.replace(oldGridBlock, newGridBlock);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('App.jsx paginado con éxito!');
