const fs = require('fs');

let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

code = code.replace(
  "const [cliente, setCliente] = useState(initialData?.cliente || '');", 
  "const [cliente, setCliente] = useState(initialData?.procedimiento_preparacion?.cliente || initialData?.cliente || '');"
);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
