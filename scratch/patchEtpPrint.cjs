const fs = require('fs');

let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

const regexHandleSubmit = /const handleSubmit = \(e\) => \{\s*e\.preventDefault\(\);\s*if\(!isConfirmed\) return;\s*onSave\(\{ colorSystem, colorRef, glossLevel, cliente, \.\.\.formData, formula \}\);\s*\};/;

const replacementHandleSubmit = `const handleSubmit = (e) => {
    e.preventDefault();
    if(!isConfirmed) return;
    if (isSupervisorView) {
        onSave({ colorSystem, colorRef, glossLevel, cliente, ...formData, formula });
    } else {
        window.print();
    }
  };`;

code = code.replace(regexHandleSubmit, replacementHandleSubmit);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
