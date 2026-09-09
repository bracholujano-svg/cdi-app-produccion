const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(
    "else if (target === 'shift') setShiftNoteText(prev => (prev ? prev + ' ' : '') + text.trim());",
    "else if (target === 'planta' || target === 'shift') setShiftNoteText(prev => (prev ? prev + ' ' : '') + text.trim());"
);

fs.writeFileSync('src/App.jsx', code);
