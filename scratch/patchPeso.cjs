const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

code = code.replace(
  /<input type="text" value=\{item\.peso\} readOnly /g,
  "<input type=\"text\" value={item.peso_g || item.peso} readOnly "
);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
