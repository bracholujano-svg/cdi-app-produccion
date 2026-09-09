const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

const oldPrintPDF = `const handlePrintPDF = async () => {
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
  };`;

const newPrintPDF = `const handlePrintPDF = async () => {
    if (!componentRef.current) return;
    try {
        setIsLoading(true);
        const el = componentRef.current;
        const originalWidth = el.style.width;
        const originalHeight = el.style.height;
        const originalPosition = el.style.position;
        const originalOverflow = el.style.overflow;
        const originalBg = el.style.backgroundColor;
        
        el.style.width = '1200px';
        el.style.height = 'max-content';
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.overflow = 'visible';
        el.style.backgroundColor = '#ffffff';
        el.style.zIndex = '-9999';

        await new Promise(r => setTimeout(r, 200));
        
        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: 1200,
            windowWidth: 1200
        });
        
        el.style.width = originalWidth;
        el.style.height = originalHeight;
        el.style.position = originalPosition;
        el.style.overflow = originalOverflow;
        el.style.backgroundColor = originalBg;
        el.style.zIndex = 'auto';
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(\`ETP_\${colorRef || 'Color'}.pdf\`);
    } catch (err) {
        console.error("Error al generar PDF:", err);
    } finally {
        setIsLoading(false);
    }
  };`;

code = code.replace(oldPrintPDF, newPrintPDF);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
