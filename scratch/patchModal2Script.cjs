const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

// Add showOperarioModal state
code = code.replace(
  "const [showEtpModal, setShowEtpModal] = useState(false);",
  "const [showEtpModal, setShowEtpModal] = useState(false);\n    const [showOperarioModal, setShowOperarioModal] = useState(false);"
);

// Modify guardarReceta to use showOperarioModal
code = code.replace(
  "setSavedColorData({ id: colorId, codigo_objetivo: codObj });\n        setShowEtpModal(true);",
  "setSavedColorData({ id: colorId, codigo_objetivo: codObj });\n        setShowOperarioModal(true);"
);

// Wait, the button "VER ETP" or "LLENAR ETP" sets showEtpModal(true).
// If it is 'borrador' or 'pendiente_revision', it should use showOperarioModal.
code = code.replace(
  `onClick={() => {
                            setSavedColorId(colorEncontrado.id);
                            setSavedColorData(colorEncontrado);
                            setShowEtpModal(true);
                        }}`,
  `onClick={() => {
                            setSavedColorId(colorEncontrado.id);
                            setSavedColorData(colorEncontrado);
                            if (colorEncontrado.estado_aprobacion === 'aprobado_produccion') {
                                setShowEtpModal(true);
                            } else {
                                setShowOperarioModal(true);
                            }
                        }}`
);

// Modify the render block
const originalRenderBlock = `{showEtpModal && (
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
      )}`;

// We need a safer replace because whitespace might not match exactly.
// Let's do it using Regex.
const replaceBlock = `
const startIdx = code.indexOf('{showEtpModal && (');
if (startIdx !== -1) {
  const endIdx = code.indexOf('</div>\\n    );\\n}');
  if (endIdx !== -1) {
    code = code.slice(0, startIdx) + \`${newRenderBlock.replace(/\\/g, '\\\\').replace(/\$/g, '\\$').replace(/\`/g, '\\`')}\` + '\\n      ' + code.slice(endIdx);
  }
}
`;

fs.writeFileSync('scratch/patchModal2.cjs', `
const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

code = code.replace(
  "const [showEtpModal, setShowEtpModal] = useState(false);",
  "const [showEtpModal, setShowEtpModal] = useState(false);\\n    const [showOperarioModal, setShowOperarioModal] = useState(false);"
);

code = code.replace(
  "setSavedColorData({ id: colorId, codigo_objetivo: codObj });\\n        setShowEtpModal(true);",
  "setSavedColorData({ id: colorId, codigo_objetivo: codObj });\\n        setShowOperarioModal(true);"
);

code = code.replace(
  \`onClick={() => {\\n                            setSavedColorId(colorEncontrado.id);\\n                            setSavedColorData(colorEncontrado);\\n                            setShowEtpModal(true);\\n                        }}\`,
  \`onClick={() => {\\n                            setSavedColorId(colorEncontrado.id);\\n                            setSavedColorData(colorEncontrado);\\n                            if (colorEncontrado.estado_aprobacion === 'aprobado_produccion') {\\n                                setShowEtpModal(true);\\n                            } else {\\n                                setShowOperarioModal(true);\\n                            }\\n                        }}\`
);

${replaceBlock}

fs.writeFileSync('src/components/SCEntonacion.jsx', code);
`);
