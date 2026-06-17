const fs = require('fs');

const appPath = './src/App.jsx';
let appContent = fs.readFileSync(appPath, 'utf8');

// Find the style block
const styleStart = appContent.indexOf('<style>{`');
const styleEnd = appContent.indexOf('`}</style>') + 10;

if (styleStart !== -1 && styleEnd !== -1) {
    const styleContent = appContent.substring(styleStart + 9, styleEnd - 10);
    
    // Remove the style block from App.jsx
    appContent = appContent.substring(0, styleStart) + appContent.substring(styleEnd);
    fs.writeFileSync(appPath, appContent);
    
    // Read index.css
    const cssPath = './src/index.css';
    let cssContent = fs.readFileSync(cssPath, 'utf8');
    
    // Add custom animations to the extracted style content
    const additionalCSS = `
/* Custom Animations */
@keyframes bgPulseRed {
  0%, 100% { background-color: rgba(248, 113, 113, 0.1); }
  50% { background-color: rgba(248, 113, 113, 0.4); }
}
@keyframes bgPulseOrange {
  0%, 100% { background-color: rgba(249, 115, 22, 0.1); }
  50% { background-color: rgba(249, 115, 22, 0.4); }
}
.animate-bg-pulse-red {
  animation: bgPulseRed 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.animate-bg-pulse-orange {
  animation: bgPulseOrange 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
`;

    cssContent += "\n" + styleContent + additionalCSS;
    fs.writeFileSync(cssPath, cssContent);
    console.log('Successfully moved styles to index.css and added custom animations.');
} else {
    console.log('Style block not found in App.jsx');
}
