const getDaysLeft = (targetDate) => {
    if (!targetDate || String(targetDate).trim() === '') return null;
    try {
        const today = new Date('2026-07-07T00:00:00'); 
        let target = String(targetDate).includes('T') ? new Date(targetDate) : new Date(targetDate + 'T12:00:00');
        target.setHours(0,0,0,0);
        if (isNaN(target.getTime()) || target.getFullYear() < 2000) return null;
        return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    } catch(e) { return null; }
};
console.log('15/07/2026 =>', getDaysLeft('15/07/2026'));
console.log('07/15/2026 =>', getDaysLeft('07/15/2026'));
console.log('2026-15-07 =>', getDaysLeft('2026-15-07'));
console.log('2026-07-15 =>', getDaysLeft('2026-07-15'));
console.log('03/07/2026 =>', getDaysLeft('03/07/2026'));
console.log('15/07 =>', getDaysLeft('15/07'));
console.log('15-07 =>', getDaysLeft('15-07'));
