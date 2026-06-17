const fs = require('fs');
const path = require('path');

const appFilePath = path.join(__dirname, '..', 'src', 'App.jsx');
let appContent = fs.readFileSync(appFilePath, 'utf-8');

const regex = /:root,\s*\[data-theme="light"\],\s*\[data-theme="dark"\]\s*\{[\s\S]*?\/\* Vibrant Accents \*\/[\s\S]*?--danger:\s*#EF4444;\s*\}/m;

const properThemeStr = `:root, [data-theme="light"] {
              --bg-main: #F8FAFC; 
              --card-bg: #FFFFFF; 
              --bg-header: rgba(248, 250, 252, 0.95); 
              --bg-input: #FFFFFF; 
              --text-main: #0F172A; 
              --text-muted: #64748B; 
              --border-color: rgba(15, 23, 42, 0.1); 
              --primary: #2563EB; 
              --accent: #059669; 
              --danger: #DC2626; 
          }
          [data-theme="dark"] {
              --bg-main: #0B0F19; 
              --card-bg: #1E293B; 
              --bg-header: rgba(11, 15, 25, 0.95); 
              --bg-input: #0F172A; 
              --text-main: #FFFFFF; 
              --text-muted: #94A3B8; 
              --border-color: rgba(148, 163, 184, 0.15); 
              --primary: #3B82F6; 
              --accent: #10B981; 
              --danger: #EF4444; 
          }`;

if (regex.test(appContent)) {
    appContent = appContent.replace(regex, properThemeStr);
    fs.writeFileSync(appFilePath, appContent, 'utf-8');
    console.log('App.jsx CSS modificado con regex.');
} else {
    console.log('No se encontró el bloque CSS.');
}
