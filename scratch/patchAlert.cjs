const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

const oldCode = `        if (recetaError) throw recetaError;
        
        setSearchFeedback('✅ ¡Fórmula guardada como borrador! Complete la ETP.');
        setSavedColorId(colorId);
        setSavedColorData({ id: colorId, codigo_objetivo: codObj });
        setShowOperarioModal(true);`;

const newCode = `        if (recetaError) throw recetaError;
        
        setSearchFeedback('✅ ¡Fórmula guardada como borrador! Complete la ETP.');
        setSavedColorId(colorId);
        setSavedColorData({ id: colorId, codigo_objetivo: codObj });
        alert('✅ Fórmula guardada exitosamente. A continuación declare el proceso de la muestra.');
        setShowOperarioModal(true);`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('src/components/SCEntonacion.jsx', code, 'utf8');
  console.log('SCEntonacion.jsx alert patched');
} else {
  console.log('Could not find code to replace in SCEntonacion.jsx');
}
