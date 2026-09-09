const fs = require('fs');

let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

// Ensure EtpCopilotForm is imported
if (!code.includes('import EtpCopilotForm')) {
    code = code.replace("import OperarioPasoDos from './forms/OperarioPasoDos';", "import OperarioPasoDos from './forms/OperarioPasoDos';\nimport EtpCopilotForm from './forms/EtpCopilotForm';");
}

const regexModal = /\{showEtpModal && \([\s\S]*?<OperarioPasoDos[\s\S]*?\/>\s*\)\}/;

const replacementModal = `{showEtpModal && (
        savedColorData?.estado_aprobacion === 'aprobado_produccion' ? (
          <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4">
              <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-50 dark:bg-[#0f172a] rounded-3xl relative">
                  <button onClick={() => setShowEtpModal(false)} className="absolute top-4 right-4 z-50 p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                      ✕
                  </button>
                  <div className="p-4">
                      <EtpCopilotForm 
                          colorId={savedColorId} 
                          initialData={savedColorData}
                          isSupervisorView={false} 
                          onCancel={() => setShowEtpModal(false)}
                      />
                  </div>
              </div>
          </div>
        ) : (
          <OperarioPasoDos 
              colorBorradorId={savedColorId}
              onClose={() => {
                  setShowEtpModal(false); 
                  setShowFormulacion(false); 
                  setFilasReceta([]); 
                  handleBuscar();
              }}
              onGuardarExitoso={() => {
                  alert('ETP enviada a revisión con éxito.');
                  setShowEtpModal(false);
                  setShowFormulacion(false);
                  setFilasReceta([]);
                  handleBuscar();
              }}
          />
        )
      )}`;

code = code.replace(regexModal, replacementModal);
fs.writeFileSync('src/components/SCEntonacion.jsx', code);
