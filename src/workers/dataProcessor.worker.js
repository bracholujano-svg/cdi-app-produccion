// src/workers/dataProcessor.worker.js
// Este Web Worker permite ejecutar filtros y algoritmos sobre miles de registros en un hilo paralelo.
// Evita que la interfaz de React se congele (evita el bloqueo del Single Thread del navegador).

self.addEventListener('message', (e) => {
    const { action, payload } = e.data;
  
    if (action === 'FILTER_MASSIVE_DATA') {
      try {
        const { data, searchTerm } = payload;
        
        if (!searchTerm) {
          self.postMessage({ status: 'SUCCESS', data: data });
          return;
        }

        const lowerSearch = searchTerm.toLowerCase().trim();
        const searchTerms = lowerSearch ? lowerSearch.split(/\s+/) : [];
        
        // Filtrado intensivo sobre arrays grandes (ej. Inventario o Catálogos)
        const results = data.filter(item => {
            return searchTerms.every(term => 
                (item.descripcion && item.descripcion.toLowerCase().includes(term)) || 
                (item.id_referencia && item.id_referencia.toLowerCase().includes(term)) ||
                (item.codigo_barras && String(item.codigo_barras).toLowerCase().includes(term))
            );
        });
  
        // Enviar resultados procesados de vuelta al hilo principal de React
        self.postMessage({ status: 'SUCCESS', data: results });
      } catch (error) {
        self.postMessage({ status: 'ERROR', error: error.message });
      }
    }
  });
