const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(
    /shareToWhatsApp=\{shareToWhatsApp\}\s*toggleMic=\{toggleMic\}\s*\/>/,
    'shareToWhatsApp={shareToWhatsApp}\n        toggleMic={toggleMic}\n        isListening={isListening}\n        activeDictationTarget={activeDictationTarget}\n      />'
);

code = code.replace(
    /updateTransfer=\{handleBulkTransfer\}\s*toggleMic=\{toggleMic\}\s*\/>/,
    'updateTransfer={handleBulkTransfer}\n          toggleMic={toggleMic}\n          isListening={isListening}\n          activeDictationTarget={activeDictationTarget}\n        />'
);

fs.writeFileSync('src/App.jsx', code);
