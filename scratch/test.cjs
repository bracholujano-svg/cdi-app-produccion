const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');
let modified = false;

// 3. Print Function
const printStart = code.indexOf('const handlePrintPDF =');
if (printStart !== -1) {
  const printEnd = code.indexOf('};', code.indexOf('setIsLoading(false);', printStart)) + 2;
  if (printEnd > printStart) {
      const newPrint = `const handlePrintPDF = () => { window.print(); };`;
      code = code.substring(0, printStart) + newPrint + code.substring(printEnd);
      modified = true;
  }
}

if (modified) fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
console.log('Modified:', modified);
