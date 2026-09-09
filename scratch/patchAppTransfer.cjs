const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(
  /const updateTransfer = async \(id, areas, date, operario, _, isPartial\) => \{/g,
  'const updateTransfer = async (id, areas, date, operario, _, isPartial, partialQty) => {'
);

code = code.replace(
  /isPartial: isPartial,\n\s*tempAssignedPersonnel/g,
  'isPartial: isPartial,\n            partialQty: partialQty,\n            tempAssignedPersonnel'
);

code = code.replace(
  /const handleBulkTransfer = async \(ids, areas, date, operario, _, isPartial\) => \{\n\s*await updateTransfer\(ids, areas, date, operario, _, isPartial\);/g,
  'const handleBulkTransfer = async (ids, areas, date, operario, _, isPartial, partialQty) => {\n    await updateTransfer(ids, areas, date, operario, _, isPartial, partialQty);'
);

fs.writeFileSync('src/App.jsx', code);
