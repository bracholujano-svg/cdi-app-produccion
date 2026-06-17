const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'orders', 'OrderDetailsModal.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// The button has a specific onClick structure. We replace it precisely using a broad regex.
content = content.replace(
    /onClick=\{\(\)=>\{\s*const en = document\.getElementById\('entregadoPor'\)\.value\.trim\(\)\.toUpperCase\(\);\s*const re = document\.getElementById\('recibidoPor'\)\.value\.trim\(\)\.toUpperCase\(\);\s*if\(en && re && tempTransferDate\) updateTransfer\(selectedOrder\.id, tempTransferArea,\s*tempTransferDate, en, re\);\s*\}\}/g,
    `onClick={()=>{
                              const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                              if(en && tempTransferDate) {
                                updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en);
                              } else {
                                alert("Debe firmar la entrega e indicar la fecha.");
                              }
                          }}`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('OrderDetailsModal parcheado con éxito v4!');
