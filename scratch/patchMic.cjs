const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const oldMic = `const { isListening, toggleMic, activeDictationTarget } = useVoiceInput(React.useCallback((target, text) => {
      // Logic handled via hook
  }, []));`;

const newMic = `const { isListening, toggleMic, activeDictationTarget } = useVoiceInput(React.useCallback((target, text) => {
    if (target === 'transfer') setTransferNota(prev => (prev ? prev + ' ' : '') + text.trim());
    else if (target === 'shift') setShiftNoteText(prev => (prev ? prev + ' ' : '') + text.trim());
    else if (target === 'calidad') setCalidadNota(prev => (prev ? prev + ' ' : '') + text.trim());
    else if (target === 'coord') setInputManualDetalle(prev => (prev ? prev + ' ' : '') + text.trim());
  }, [setTransferNota, setShiftNoteText, setCalidadNota, setInputManualDetalle]));`;

if (code.includes('// Logic handled via hook')) {
    code = code.replace(oldMic, newMic);
    fs.writeFileSync('src/App.jsx', code);
    console.log('Successfully patched Mic');
} else {
    console.log('Mic boundary not found');
}
