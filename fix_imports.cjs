const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

const importsToAdd = "import { useVoiceInput } from './hooks/useVoiceInput';\nimport { useImageProcessor } from './hooks/useImageProcessor';\nimport { shareToWhatsApp } from './services/NotificationService';\nimport { executeExcelSearch, fillFormWithResult } from './services/ExternalSearchService';\n";

if (!app.includes("import { useVoiceInput }")) {
    const lastImportIndex = app.lastIndexOf("import ");
    const lastImportEnd = app.indexOf("\n", lastImportIndex);
    app = app.substring(0, lastImportEnd + 1) + importsToAdd + app.substring(lastImportEnd + 1);
    fs.writeFileSync('src/App.jsx', app);
    console.log("Added imports");
}
