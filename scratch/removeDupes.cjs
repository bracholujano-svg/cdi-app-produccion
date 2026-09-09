const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

const s1 = "import { useVoiceInput } from './hooks/useVoiceInput';\nimport { shareToWhatsApp } from './services/NotificationService';\n";
app = app.replace(s1, '');

fs.writeFileSync('src/App.jsx', app);
