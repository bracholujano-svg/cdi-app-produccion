const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

const removeRegex = (regex) => {
    app = app.replace(regex, '');
};

removeRegex(/const handleBulkTransfer = async \(areas\) => \{[\s\S]*?alert\("Error en transferencia masiva: " \+ err\.message\);\n\s*\}\n\s*\};\n/);
removeRegex(/const doExcelSearch = async \(searchTerm\) => \{[\s\S]*?\}\n\s*\};\n/);
removeRegex(/const fillFormWithResult = \(result, fillFn\) => \{[\s\S]*?\}\n\s*\};\n/);
removeRegex(/const handleWhatsAppShare = \(order\) => \{[\s\S]*?\}\n\s*\};\n/);

fs.writeFileSync('src/App.jsx', app);
