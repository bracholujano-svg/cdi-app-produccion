const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

// A function to remove a code block from an exact string signature to the matching brace
function removeFunctionBlockBySubstring(content, searchString) {
    const startIndex = content.indexOf(searchString);
    if (startIndex === -1) return content;
    
    // find nearest {
    const braceStart = content.indexOf('{', startIndex);
    
    let openBraces = 0;
    let endIndex = -1;
    let started = false;
    
    for (let i = braceStart; i < content.length; i++) {
        if (content[i] === '{') {
            openBraces++;
            started = true;
        } else if (content[i] === '}') {
            openBraces--;
            if (started && openBraces === 0) {
                if (content[i+1] === ';') endIndex = i + 2; else endIndex = i + 1;
                // if it's a useEffect it has }, []);
                if (content.substring(endIndex, endIndex + 5) === ', [])') endIndex += 5;
                if (content.substring(endIndex, endIndex + 6) === ', []);') endIndex += 6;
                break;
            }
        }
    }
    
    if (endIndex !== -1) {
        // Find the start of the line for startIndex to delete the whole block cleanly
        let lineStart = startIndex;
        while (lineStart > 0 && content[lineStart - 1] !== '\n') lineStart--;
        return content.substring(0, lineStart) + content.substring(endIndex);
    }
    return content;
}

app = removeFunctionBlockBySubstring(app, "const SpeechRecognition = window.SpeechRecognition");
app = removeFunctionBlockBySubstring(app, "const toggleMic = (target) => {");

fs.writeFileSync('src/App.jsx', app);
console.log('Removed left-over blocks');
