const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

const targetLine = '<div className="theme-bg-input border-t theme-border p-2 flex flex-col md:flex-row gap-2">';
const replacementLine = '<div className="theme-bg-input border-t theme-border p-2 flex flex-col md:flex-row gap-2 sticky top-[50px] md:top-[60px] z-40 shadow-sm">';

if (content.includes(targetLine)) {
    content = content.replace(targetLine, replacementLine);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('App.jsx modificado con Search Bar sticky.');
} else {
    console.log('No se encontró la línea objetivo en App.jsx.');
}
