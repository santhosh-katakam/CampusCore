const http = require('http');
function get(path) {
    return new Promise((res, rej) => {
        const req = http.request({ hostname: 'localhost', port: 4000, path, method: 'GET', headers: { 'x-institution-id': '69884fc9b7b03d132ba7f832' } }, (r) => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, b: d }));
        }); req.on('error', rej); req.end();
    });
}
async function main() {
    // Get batch list
    const r1 = await get('/api/reports/batch');
    const batches = JSON.parse(r1.b);
    console.log('=== BATCH PERIOD COUNTS (AFTER FIX) ===');
    batches.forEach(b => {
        const flag = b.totalPeriods > 40 ? '⚠️ HIGH' : b.totalPeriods <= 35 ? '✅ OK' : '✅ OK';
        console.log(`${flag} ${b.batchName}: ${b.totalPeriods} periods`);
    });

    // Test faculty report
    const r2 = await get('/api/reports/faculty');
    const fac = JSON.parse(r2.b);
    const names = Object.keys(fac);
    console.log(`\n=== FACULTY REPORT – ${names.length} faculty returned ===`);
    names.slice(0, 3).forEach(n => {
        const f = fac[n];
        console.log(`  ${n}: ${f.totalHours} hours, ${f.schedule?.length} schedule entries`);
    });
}
main().catch(console.error);
