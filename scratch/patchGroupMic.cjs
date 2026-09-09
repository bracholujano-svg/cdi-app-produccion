const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(
    '<GroupDetailsModal activeGroupObj={activeGroupObj} handleImageUpload={handleImageUpload} \naddShiftNote={addShiftNote} toggleMic={toggleMic} />',
    '<GroupDetailsModal activeGroupObj={activeGroupObj} handleImageUpload={handleImageUpload} addShiftNote={addShiftNote} toggleMic={toggleMic} isListening={isListening} activeDictationTarget={activeDictationTarget} />'
);
// fallback in case of no newline
code = code.replace(
    '<GroupDetailsModal activeGroupObj={activeGroupObj} handleImageUpload={handleImageUpload} addShiftNote={addShiftNote} toggleMic={toggleMic} />',
    '<GroupDetailsModal activeGroupObj={activeGroupObj} handleImageUpload={handleImageUpload} addShiftNote={addShiftNote} toggleMic={toggleMic} isListening={isListening} activeDictationTarget={activeDictationTarget} />'
);

fs.writeFileSync('src/App.jsx', code);
