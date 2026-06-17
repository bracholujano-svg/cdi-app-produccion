const fs = require('fs');

function patchModal() {
    const p = 'src/components/orders/OrderDetailsModal.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // 1. Remove the recibidoPor input and make entregadoPor span 1 col
    const regexInputs = /<div className="grid grid-cols-2 gap-2">\s*<input id="entregadoPor"[^>]*>\s*<input id="recibidoPor"[^>]*>\s*<\/div>/;
    const newInputs = `<div className="grid grid-cols-1 gap-2">
                              <input id="entregadoPor" defaultValue={supervisorProfile?.name} className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base uppercase border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="FIRMA ENTREGA" />
                          </div>`;
    content = content.replace(regexInputs, newInputs);

    // 2. Fix the button logic
    const regexButton = /<button type="button" onClick=\{\(\)=>\{\s*const en = document\.getElementById\('entregadoPor'\)\.value\.trim\(\)\.toUpperCase\(\);\s*const re = document\.getElementById\('recibidoPor'\)\.value\.trim\(\)\.toUpperCase\(\);\s*if\(en && re && tempTransferDate\) updateTransfer\(selectedOrder\.id, tempTransferArea, tempTransferDate, en, re\);\s*\}\} className="w-full bg-\[var\(--accent\)\] text-\[var\(--card-bg\)\] py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-\[var\(--border-color\)\] transition-all duration-200\s*hover:brightness-125 active:scale-95">Confirmar Entrega de Sección<\/button>/;
    
    const newButton = `<button type="button" onClick={()=>{
                              const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                              if(en && tempTransferDate) {
                                  updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en);
                              } else {
                                  alert("Ingrese su nombre (Firma Entrega) para enviar la solicitud.");
                              }
                          }} className="w-full bg-[var(--accent)] text-[var(--card-bg)] py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--border-color)] transition-all duration-200 hover:brightness-125 active:scale-95">Enviar Solicitud de Entrega</button>`;
                          
    content = content.replace(regexButton, newButton);

    fs.writeFileSync(p, content, 'utf8');
}

try {
    patchModal();
    console.log("Patched OrderDetailsModal.");
} catch(e) {
    console.error(e);
}
