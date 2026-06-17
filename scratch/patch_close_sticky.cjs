const fs = require('fs');
const path = require('path');

const appFilePath = path.join(__dirname, '..', 'src', 'App.jsx');
let appContent = fs.readFileSync(appFilePath, 'utf-8');

const regexToReplace = /<\/div>\s*<\/div>\s*<\/div>\s*<main className="w-full px-4 md:px-8 p-4 md:p-6 min-h-screen">/g;
const replacement = `                  </div>
              </div>
          </div>
      </div>

      <main className="w-full px-4 md:px-8 p-4 md:p-6 min-h-screen">`;

if (regexToReplace.test(appContent)) {
    appContent = appContent.replace(regexToReplace, replacement);
    fs.writeFileSync(appFilePath, appContent, 'utf-8');
    console.log('App.jsx cerrado contenedor sticky exitosamente.');
} else {
    console.log('No se pudo encontrar el punto de cierre.');
}
