const fs = require('fs');

let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

const searchStr = `          </div>
        </div>
      );
    }

  // Vista 1: Buscador`;

const replaceStr = `          </div>
        </div>

        {/* Inyectamos Modales aquí también porque sino no se ven cuando showFormulacion es true */}
        {showEtpModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
                <div className="bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl relative my-8">
                    <button onClick={() => { setShowEtpModal(false); setShowFormulacion(false); handleBuscar(); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors z-50">
                        <X size={24} />
                    </button>
                    <EtpCopilotForm 
                        colorId={savedColorId} 
                        initialData={savedColorData}
                        supervisorProfile={supervisorProfile} 
                        isSupervisorView={false} 
                        onSave={() => { setShowEtpModal(false); setShowFormulacion(false); setFilasReceta([]); handleBuscar(); }} 
                        onCancel={() => { setShowEtpModal(false); setShowFormulacion(false); handleBuscar(); }} 
                    />
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

      </div>
      );
    }

  // Vista 1: Buscador`;

// Note: I need to be careful with CRLF.
// Let's use regex or split to avoid CRLF mismatch!
code = code.replace(/<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}\s*\/\/\s*Vista 1: Buscador/s, replaceStr);

fs.writeFileSync('src/components/SCEntonacion.jsx', code, 'utf8');
console.log('SCEntonacion.jsx patched successfully');
