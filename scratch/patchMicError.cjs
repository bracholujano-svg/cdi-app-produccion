const fs = require('fs');
let code = fs.readFileSync('src/hooks/useVoiceInput.js', 'utf8');

code = code.replace(
    'recognition.onerror = () => setIsListening(false);',
    'recognition.onerror = (e) => { alert("Error de micrófono: " + (e.error || e.message || "Desconocido")); setIsListening(false); };'
);

fs.writeFileSync('src/hooks/useVoiceInput.js', code);
