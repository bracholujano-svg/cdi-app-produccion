const fs = require('fs');

const path = './src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetCSS = `:root, [data-theme="light"], [data-theme="dark"] {
            /* Forced Dark Mode - Digital Banking Pro Max */
            --bg-main: #0B0F19; 
            --card-bg: #1E293B; 
            --bg-header: rgba(11, 15, 25, 0.85); 
            --bg-input: #0F172A; 
            --text-main: #FFFFFF; 
            --text-muted: #94A3B8; 
            --border-color: rgba(148, 163, 184, 0.15); 
            
            /* Vibrant Accents */
            --primary: #3B82F6; /* Electric Blue */
            --accent: #10B981; /* Neon Green */
            --danger: #EF4444; 
        }`;

const replacementCSS = `:root, [data-theme="light"] {
            --bg-main: #F1F5F9; 
            --card-bg: #FFFFFF; 
            --bg-header: rgba(255, 255, 255, 0.95); 
            --bg-input: #FFFFFF; 
            --text-main: #0F172A; 
            --text-muted: #64748B; 
            --border-color: rgba(15, 23, 42, 0.1); 
            
            --primary: #3B82F6; 
            --accent: #10B981; 
            --danger: #EF4444; 
        }

        [data-theme="dark"] {
            --bg-main: #0B0F19; 
            --card-bg: #1E293B; 
            --bg-header: rgba(11, 15, 25, 0.85); 
            --bg-input: #0F172A; 
            --text-main: #FFFFFF; 
            --text-muted: #94A3B8; 
            --border-color: rgba(148, 163, 184, 0.15); 
            
            --primary: #3B82F6; 
            --accent: #10B981; 
            --danger: #EF4444; 
        }`;

content = content.replace(targetCSS, replacementCSS);
fs.writeFileSync(path, content);
console.log('App.jsx CSS fixed!');
