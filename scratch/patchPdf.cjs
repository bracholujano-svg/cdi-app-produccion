const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

// Imports
code = code.replace(
  "import React, { useState, useEffect } from 'react';",
  "import React, { useState, useEffect, useRef } from 'react';\nimport html2canvas from 'html2canvas';\nimport jsPDF from 'jspdf';"
);

// Add componentRef
code = code.replace(
  "const [isMobileCopilotOpen, setIsMobileCopilotOpen] = useState(false);",
  "const [isMobileCopilotOpen, setIsMobileCopilotOpen] = useState(false);\n  const componentRef = useRef(null);"
);

// Attach ref
code = code.replace(
  '<div className="w-full flex flex-col bg-slate-50 relative h-[800px] overflow-y-auto custom-scroll">',
  '<div ref={componentRef} className="w-full flex flex-col bg-slate-50 relative h-[800px] overflow-y-auto custom-scroll">'
);

// Replace print handling in handleSubmit OR create handlePrintPDF
// Currently the button says "Liberar OP / Imprimir".
// We will change the `window.print()` inside `handleSubmit` to call `handlePrintPDF()`
const handlePrintPdfFunc = `
  const handlePrintPDF = async () => {
    if (!componentRef.current) return;
    try {
        setIsLoading(true);
        const el = componentRef.current;
        const originalClasses = el.className;
        // Quitar clases problemáticas
        el.className = originalClasses.replace('h-[800px]', 'h-auto').replace('overflow-y-auto', 'overflow-visible');
        
        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: true,
            windowWidth: el.scrollWidth,
            windowHeight: el.scrollHeight
        });
        
        el.className = originalClasses;
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(\`ETP_\${colorRef || 'Color'}.pdf\`);
    } catch (err) {
        console.error("Error al generar PDF:", err);
    } finally {
        setIsLoading(false);
    }
  };
`;

code = code.replace(
  "const handleSubmit = (e) => {",
  handlePrintPdfFunc + "\n  const handleSubmit = (e) => {"
);

code = code.replace(
  "window.print();",
  "handlePrintPDF();"
);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
