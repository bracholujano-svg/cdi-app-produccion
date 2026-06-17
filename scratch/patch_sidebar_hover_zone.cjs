const fs = require('fs');
const path = require('path');

const sidebarFilePath = path.join(__dirname, '..', 'src', 'components', 'layout', 'Sidebar.jsx');
let sidebarContent = fs.readFileSync(sidebarFilePath, 'utf-8');

const triggerToReplace = `{/* SIDEBAR TRIGGER FLOTANTE */}
      <button`;

const newTrigger = `{/* ZONA INVISIBLE DE HOVER EN TODO EL BORDE IZQUIERDO */}
      <div 
        onMouseEnter={() => setIsSidebarOpen(true)}
        className="fixed left-0 top-0 w-6 h-full z-[55] bg-transparent hidden md:block"
      />

      {/* SIDEBAR TRIGGER FLOTANTE */}
      <button`;

if (!sidebarContent.includes('ZONA INVISIBLE DE HOVER EN TODO EL BORDE IZQUIERDO')) {
    sidebarContent = sidebarContent.replace(triggerToReplace, newTrigger);
    fs.writeFileSync(sidebarFilePath, sidebarContent, 'utf-8');
    console.log('Sidebar.jsx zona de hover expandida al borde izquierdo completo.');
} else {
    console.log('Sidebar ya tenía la zona de hover.');
}
