const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /if \(!supervisorProfile\) return <LoginScreen \/>;\s*<div className="flex gap-2 justify-between">/m;

const replacementStr = `  if (!supervisorProfile) return <LoginScreen />;

  return (
    <div className="min-h-screen font-sans pb-20 transition-colors duration-300 theme-bg-main" data-theme={appTheme}>
      
      <Header />
      <Sidebar />
        <div className="theme-bg-main border-b theme-border p-2 flex flex-col md:flex-row gap-2 sticky top-[60px] md:top-[68px] z-40 shadow-sm transition-all duration-300">
            <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={"1.2em"} />
                <input type="text" placeholder="Buscar pedido, artículo o producto..." className="w-full pl-8 pr-3 py-2 md:py-2.5 rounded-lg theme-bg-card font-bold text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base outline-none border theme-border focus:ring-2 focus:ring-[var(--primary)]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            <div className="flex gap-2 justify-between">`;

if (regex.test(content)) {
    content = content.replace(regex, replacementStr);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('App.jsx restaurado con regex.');
} else {
    console.log('Fallo el regex.');
}
