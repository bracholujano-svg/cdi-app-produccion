const fs = require('fs');
const path = require('path');

const appFilePath = path.join(__dirname, '..', 'src', 'App.jsx');
let appContent = fs.readFileSync(appFilePath, 'utf-8');

const regexToReplace = /<Header \/>\s*<Sidebar \/>\s*<div className="theme-bg-main border-b theme-border p-2 flex flex-col md:flex-row gap-2 sticky top-\[60px\] md:top-\[68px\] z-40 shadow-sm transition-all duration-300">/g;

const replacement = `<Sidebar />
      <div className="sticky top-0 z-50 flex flex-col w-full shadow-md">
        <Header />
        <div className="theme-bg-main border-b theme-border p-2 flex flex-col md:flex-row gap-2">`;

if (regexToReplace.test(appContent)) {
    appContent = appContent.replace(regexToReplace, replacement);
    fs.writeFileSync(appFilePath, appContent, 'utf-8');
    console.log('App.jsx Header y SearchBar envueltos en contenedor sticky.');
} else {
    console.log('No se encontró el bloque para envolver.');
}

// También eliminamos sticky del Header interno para evitar conflictos
const headerFilePath = path.join(__dirname, '..', 'src', 'components', 'layout', 'Header.jsx');
let headerContent = fs.readFileSync(headerFilePath, 'utf-8');

headerContent = headerContent.replace(
    /className=\{\`theme-bg-header p-2 md:p-3 sticky \$\{mostUrgentOrder \? 'top-\[36px\]' : 'top-0'\} z-50 shadow-md border-b theme-border transition-all\`\}/g,
    `className={\`theme-bg-header p-2 md:p-3 border-b theme-border transition-all\`}`
);

fs.writeFileSync(headerFilePath, headerContent, 'utf-8');
console.log('Header.jsx sticky removido para evitar conflicto.');
