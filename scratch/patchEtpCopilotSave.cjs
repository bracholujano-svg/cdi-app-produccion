const fs = require('fs');

let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

const regexSubmit = /onSave\(\{ colorSystem, colorRef, glossLevel, \.\.\.formData, formula \}\);/;
const replacementSubmit = `onSave({ colorSystem, colorRef, glossLevel, cliente, ...formData, formula });`;

code = code.replace(regexSubmit, replacementSubmit);

// Also let's set formData defaults based on initialData
const regexFormData = /const \[formData, setFormData\] = useState\(\{[\s\S]*?textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano \(40% Brillo\)\.'\s*\}\);/;
const replacementFormData = `const [formData, setFormData] = useState({
    nombreComercial: initialData?.codigo_objetivo || '',
    codigoInterno: '',
    deltaE: initialData?.tolerancia_delta_e || 'ΔE < 0.8',
    fondoRequired: initialData?.sustrato_muestra || '',
    requiereFondoBlancoPuro: false,
    catalizador: initialData?.catalizador_tipo || '50% (Ref: CAT-50)',
    disolvente: initialData?.disolvente_tipo || '10% - 15% (PU)',
    boquilla: '1.3 mm',
    manos: '2 Manos Cruzadas',
    viscosidad: '18-20 seg',
    presion: '25 - 30 PSI',
    textoPreparacion: 'Lijado del sustrato (MDF) con grano 220. Aplicar 2 manos de Base Blanca. Lijar con grano 320/400.',
    textoFondo: initialData?.sustrato_muestra ? \`Fondo aplicado: \${initialData.sustrato_muestra}\` : '',
    textoColor: '',
    textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano (40% Brillo).'
  });`;

code = code.replace(regexFormData, replacementFormData);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
