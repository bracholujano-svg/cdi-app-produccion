const fs = require('fs');

let css = fs.readFileSync('src/index.css', 'utf8');

const importRegex = /@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Outfit:wght@400;500;700;800&family=Space\+Grotesk:wght@600;700;800&display=swap'\);/g;

// Remove all instances of the import
css = css.replace(importRegex, '');

// Prepend the import to the top of the file
const correctImport = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700;800&family=Space+Grotesk:wght@600;700;800&display=swap');\n`;
css = correctImport + css;

fs.writeFileSync('src/index.css', css);
console.log('Fixed index.css import order');
