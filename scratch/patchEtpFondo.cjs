const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

// 1. Initial State for textoFondo
const searchState = "textoFondo: initialData?.sustrato_muestra ? `Fondo aplicado: ${initialData.sustrato_muestra}` : '',";

// Parse new fondo data
const newFondoLogic = `
  (() => {
    let fondoText = initialData?.sustrato_muestra ? \`Sustrato: \${initialData.sustrato_muestra}\` : '';
    if (initialData?.procedimiento_preparacion?.fondo && typeof initialData.procedimiento_preparacion.fondo === 'object') {
       const f = initialData.procedimiento_preparacion.fondo;
       fondoText += \`\\nBase: \${f.tipo} (\${f.color}). Manos: \${f.manos}.\`;
       fondoText += \`\\nMezcla Base: Cat \${f.catalizador} / Disolv \${f.disolvente}\`;
    }
    return fondoText;
  })()
`;

const newState = `textoFondo: ${newFondoLogic.trim()},`;

if (code.includes(searchState)) {
  code = code.replace(searchState, newState);
  fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code, 'utf8');
  console.log('EtpCopilotForm textoFondo patched');
} else {
  console.log('Could not find textoFondo state in EtpCopilotForm');
}
