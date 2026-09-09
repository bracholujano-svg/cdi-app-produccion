const fs = require('fs');

let opCode = fs.readFileSync('src/components/forms/OperarioPasoDos.jsx', 'utf8');

// Move imagen_muestra INTO procedimiento_preparacion JSONB in OperarioPasoDos
const oldOpUpdate = `procedimiento_preparacion: {
             preparacion: formData.procedimiento_preparacion,
             fondo: '',
             color: '',
             acabado: ''
           },
           imagen_muestra: imagenMuestra,`;
           
const newOpUpdate = `procedimiento_preparacion: {
             preparacion: formData.procedimiento_preparacion,
             fondo: '',
             color: '',
             acabado: '',
             imagen_muestra: imagenMuestra
           },`;
           
opCode = opCode.replace(oldOpUpdate, newOpUpdate);
fs.writeFileSync('src/components/forms/OperarioPasoDos.jsx', opCode, 'utf8');

// Now update EtpCopilotForm.jsx to read from JSONB
let etpCode = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

const oldEtpState = `const [imagenMuestra, setImagenMuestra] = useState(initialData?.imagen_muestra || null);`;
const newEtpState = `const [imagenMuestra, setImagenMuestra] = useState(initialData?.procedimiento_preparacion?.imagen_muestra || initialData?.imagen_muestra || null);`;

etpCode = etpCode.replace(oldEtpState, newEtpState);
fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', etpCode, 'utf8');

console.log('Migrated imagen_muestra to JSONB to prevent Supabase schema crashes');
