const fs = require('fs');
let code = fs.readFileSync('src/components/orders/BulkOrderDetailsModal.jsx', 'utf8');

const regex = /<label className="flex items-center gap-2 mb-2 p-3 bg-black\/5 rounded-xl border border-black\/10 cursor-pointer hover:bg-black\/10 transition-colors">[\s\S]*?<\/label>/;

code = code.replace(regex, "");

fs.writeFileSync('src/components/orders/BulkOrderDetailsModal.jsx', code);
