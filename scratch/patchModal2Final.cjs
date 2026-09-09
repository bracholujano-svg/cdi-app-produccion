const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

// 1. Add showOperarioModal state
code = code.replace(
  "const [showEtpModal, setShowEtpModal] = useState(false);",
  "const [showEtpModal, setShowEtpModal] = useState(false);\n  const [showOperarioModal, setShowOperarioModal] = useState(false);"
);

// 2. Change logic inside guardarReceta
// We know it is right after setSavedColorData({ id: colorId, codigo_objetivo: codObj });
code = code.replace(
  "setSavedColorData({ id: colorId, codigo_objetivo: codObj });\n        setShowEtpModal(true);",
  "setSavedColorData({ id: colorId, codigo_objetivo: codObj });\n        setShowOperarioModal(true);"
);

// 3. Change "VER ETP" button behavior
code = code.replace(
  `setSavedColorData(colorEncontrado);\n                              setShowEtpModal(true);`,
  `setSavedColorData(colorEncontrado);\n                              if (colorEncontrado.estado_aprobacion === 'aprobado_produccion') { setShowEtpModal(true); } else { setShowOperarioModal(true); }`
);

// 4. Change Render Block at the bottom
const startStr = `{showEtpModal && (
        savedColorData?.estado_aprobacion === 'aprobado_produccion' ? (`;

const endStr = `/>
        )
      )}


    </div>
  );
}`;

const oldRenderBlock = code.substring(code.indexOf('{showEtpModal && ('), code.indexOf('</div>\n  );\n}'));

const newRenderBlock = `{showEtpModal && (
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
      )}
      
      {showOperarioModal && (
          <OperarioPasoDos 
              colorBorradorId={savedColorId}
              onClose={() => {
                  setShowOperarioModal(false); 
                  setShowFormulacion(false); 
                  setFilasReceta([]); 
                  handleBuscar();
              }}
              onGuardarExitoso={() => {
                  alert('ETP enviada a revisión con éxito.');
                  setShowOperarioModal(false);
                  setShowFormulacion(false);
                  setFilasReceta([]);
                  handleBuscar();
              }}
          />
      )}
    `;

if (code.includes(startStr)) {
   code = code.replace(oldRenderBlock, newRenderBlock);
}

fs.writeFileSync('src/components/SCEntonacion.jsx', code);
