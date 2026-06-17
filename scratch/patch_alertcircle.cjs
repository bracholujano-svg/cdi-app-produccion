const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'orders', 'OrderDetailsModal.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Add AlertCircle import
if (!content.includes('AlertCircle')) {
    content = content.replace(
        /import \{([\s\S]*?)\} from 'lucide-react';/,
        (match, p1) => {
            return `import {${p1}, AlertCircle } from 'lucide-react';`;
        }
    );
}

// Ensure areaFilter stringification handles null safely
content = content.replace(/String\(areaFilter\)\.trim\(\)/g, "String(areaFilter || '').trim()");

fs.writeFileSync(filePath, content, 'utf-8');
console.log('OrderDetailsModal AlertCircle parcheado con éxito!');
