const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

const regex = /<button\s+onClick=\{handleEditRecipe\}\s+className="[^"]*"\s*>\s*Modificar Receta\s*<\/button>/g;

const match = code.match(regex);
if (match) {
    const replacementStr = `${match[0]}
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
    
    code = code.replace(regex, replacementStr);
    fs.writeFileSync('src/components/SCEntonacion.jsx', code);
    console.log("SUCCESS!");
} else {
    console.log("NO MATCH FOUND");
}
