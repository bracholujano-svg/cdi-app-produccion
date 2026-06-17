const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

const filterRegex = /const filteredOrders = orders\.filter\(\(o\) => \{[\s\S]*?\}\);/;
const filterMatch = content.match(filterRegex);

if (filterMatch && !content.includes('const filteredOrders = useMemo')) {
    const originalFilter = filterMatch[0];
    const newFilter = originalFilter.replace('const filteredOrders = orders.filter', 'const filteredOrders = useMemo(() => orders.filter').replace('});', '}), [orders, searchTerm, areaFilter, viewFilter]);');
    content = content.replace(originalFilter, newFilter);
}

const groupRegex = /const groupedOrders = filteredOrders\.reduce\(\(acc, order\) => \{[\s\S]*?return acc;\s*\}, \{\}\);/;
const groupMatch = content.match(groupRegex);

if (groupMatch && !content.includes('const groupedOrders = useMemo')) {
    const originalGroup = groupMatch[0];
    const newGroup = originalGroup.replace('const groupedOrders = filteredOrders.reduce', 'const groupedOrders = useMemo(() => filteredOrders.reduce').replace('}, {});', '}, {}), [filteredOrders]);');
    content = content.replace(originalGroup, newGroup);
}

const arrayRegex = /const groupedArray = Object\.values\(groupedOrders\);/;
if (content.includes('const groupedArray = Object.values(groupedOrders);') && !content.includes('const groupedArray = useMemo')) {
    content = content.replace('const groupedArray = Object.values(groupedOrders);', 'const groupedArray = useMemo(() => Object.values(groupedOrders), [groupedOrders]);');
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('App.jsx optimizado con useMemo.');
