const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(
    'shareToWhatsApp={shareToWhatsApp}\n          toggleMic={toggleMic}\n        />',
    'shareToWhatsApp={shareToWhatsApp}\n          toggleMic={toggleMic}\n          isListening={isListening}\n          activeDictationTarget={activeDictationTarget}\n        />'
);

code = code.replace(
    'updateTransfer={handleBulkTransfer}\n            toggleMic={toggleMic}\n          />',
    'updateTransfer={handleBulkTransfer}\n            toggleMic={toggleMic}\n            isListening={isListening}\n            activeDictationTarget={activeDictationTarget}\n          />'
);

fs.writeFileSync('src/App.jsx', code);
