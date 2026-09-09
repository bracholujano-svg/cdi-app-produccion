const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

// Extract the mistakenly placed EtpModal JSX block
const startMarker = "  {showEtpModal && (";
const endMarker = "  return (";

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const extractedJsx = code.substring(startIndex, endIndex);
    // Remove it from its current position
    code = code.substring(0, startIndex) + code.substring(endIndex);
    
    // Now find the REAL main return statement of the component.
    // It's the last "return (" in the file, or usually we can just put it inside the main div.
    // Let's replace the final `</main>` or `</div>\n  );`
    
    const finalDivRegex = /<\/div>\s*\);\s*\}\s*$/;
    code = code.replace(finalDivRegex, extractedJsx + "\n    </div>\n  );\n}");
    
    fs.writeFileSync('src/components/SCEntonacion.jsx', code);
}

