const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

code = code.replace(/supabase\.from\('formulas_color'\)/g, "supabase.from('colores_aprobados')");
code = code.replace(/table: 'formulas_color'/g, "table: 'colores_aprobados'");

fs.writeFileSync('src/components/layout/Sidebar.jsx', code);
