const fs = require('fs');

let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

const oldButton = `onClick={() => {
                              setSavedColorId(colorEncontrado.id);
                              setSavedColorData(colorEncontrado);
                              setShowEtpModal(true);
                          }}`;

const newButton = `onClick={() => {
                              setSavedColorId(colorEncontrado.id);
                              setSavedColorData(colorEncontrado);
                              if (colorEncontrado?.estado_aprobacion === 'borrador') {
                                  setShowOperarioModal(true);
                              } else {
                                  setShowEtpModal(true);
                              }
                          }}`;

code = code.replace(oldButton, newButton);

const oldLabel = `{colorEncontrado?.estado_aprobacion === 'borrador' ? 'LLENAR ETP' : \n(colorEncontrado?.estado_aprobacion === 'pendiente_revision' ? 'ETP (PENDIENTE)' : 'VER ETP')}`;

const newLabel = `{colorEncontrado?.estado_aprobacion === 'borrador' ? 'DECLARAR PROCESO' : \n(colorEncontrado?.estado_aprobacion === 'pendiente_revision' ? 'VER ETP (REVISIÓN)' : 'VER ETP')}`;

code = code.replace(oldLabel, newLabel);

// Extra fallback if the first oldLabel replacement failed because of whitespace:
code = code.replace(
  "{colorEncontrado?.estado_aprobacion === 'borrador' ? 'LLENAR ETP' : (colorEncontrado?.estado_aprobacion === 'pendiente_revision' ? 'ETP (PENDIENTE)' : 'VER ETP')}",
  "{colorEncontrado?.estado_aprobacion === 'borrador' ? 'DECLARAR PROCESO' : (colorEncontrado?.estado_aprobacion === 'pendiente_revision' ? 'VER ETP (REVISIÓN)' : 'VER ETP')}"
);

fs.writeFileSync('src/components/SCEntonacion.jsx', code, 'utf8');
console.log("SCEntonacion.jsx patched for modal routing.");
