const fs = require('fs');
let code = fs.readFileSync('src/hooks/useVoiceInput.js', 'utf8');

code = code.replace(
    'if (!recognitionRef.current) return;',
    'if (!recognitionRef.current) { alert("El dictado por voz no es compatible con este navegador o faltan permisos."); return; }'
);

fs.writeFileSync('src/hooks/useVoiceInput.js', code);
