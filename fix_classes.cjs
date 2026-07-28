const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx')) { 
            results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src', 'components'));
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    content = content.replace(/text-\[var\(--color-text-main\)\]/g, 'theme-text-main');
    content = content.replace(/text-\[var\(--color-primary\)\]/g, 'theme-text-primary');
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
