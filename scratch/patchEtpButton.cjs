const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

const targetStr = `<button 
                        onClick={handleEditRecipe}
                        className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-yellow-500/30 transition-colors"
                    >
                        Modificar Receta
                    </button>`;

const replacementStr = `<button 
                        onClick={handleEditRecipe}
                        className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-yellow-500/30 transition-colors"
                    >
                        Modificar Receta
                    </button>
                    <button 
                        onClick={() => {
                            setSavedColorId(colorEncontrado.id);
                            setSavedColorData(colorEncontrado);
                            setShowEtpModal(true);
                        }}
                        className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-blue-500/30 transition-colors"
                    >
                        {colorEncontrado?.estado_aprobacion === 'borrador' ? 'LLENAR ETP' : (colorEncontrado?.estado_aprobacion === 'pendiente_revision' ? 'ETP (PENDIENTE)' : 'VER ETP')}
                    </button>`;

code = code.replace(targetStr, replacementStr);

fs.writeFileSync('src/components/SCEntonacion.jsx', code);
