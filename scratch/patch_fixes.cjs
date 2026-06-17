const fs = require('fs');
const path = require('path');

const appFilePath = path.join(__dirname, '..', 'src', 'App.jsx');
let appContent = fs.readFileSync(appFilePath, 'utf-8');

const forcedThemeStr = `          :root, [data-theme="light"], [data-theme="dark"] {
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

const properThemeStr = `          :root, [data-theme="light"] {
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

if (appContent.includes(forcedThemeStr)) {
    appContent = appContent.replace(forcedThemeStr, properThemeStr);
    fs.writeFileSync(appFilePath, appContent, 'utf-8');
    console.log('App.jsx theme toggle fixed.');
}

const sidebarFilePath = path.join(__dirname, '..', 'src', 'components', 'layout', 'Sidebar.jsx');
let sidebarContent = fs.readFileSync(sidebarFilePath, 'utf-8');

sidebarContent = sidebarContent.replace(
    `<button 
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-[60] bg-[var(--card-bg)] text-white`,
    `<button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        onMouseEnter={() => setIsSidebarOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-[60] bg-[var(--card-bg)] text-[var(--primary)]`
);

sidebarContent = sidebarContent.replace(
    `className={\`fixed top-0 left-0 h-full w-[110px] md:w-[130px] bg-[var(--bg-main)] z-[80] border-r border-[var(--border-color)] shadow-[10px_0_30px_rgba(0,0,0,0.8)] transform transition-transform duration-300 ease-in-out flex flex-col items-center py-6 gap-6 overflow-y-auto custom-scrollbar \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}\`}>`,
    `onMouseLeave={() => setIsSidebarOpen(false)}
      className={\`fixed top-0 left-0 h-full w-[110px] md:w-[130px] bg-[var(--bg-main)] z-[80] border-r border-[var(--border-color)] shadow-[10px_0_30px_rgba(0,0,0,0.8)] transform transition-transform duration-300 ease-in-out flex flex-col items-center py-6 gap-6 overflow-y-auto custom-scrollbar \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}\`}>`
);

fs.writeFileSync(sidebarFilePath, sidebarContent, 'utf-8');
console.log('Sidebar.jsx hover interaction fixed.');
