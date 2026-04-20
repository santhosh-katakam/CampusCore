const http = require('http');

function get(path) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: 'localhost', port: 4000, path, method: 'GET', headers: { 'x-institution-id': '69884fc9b7b03d132ba7f832' } }, (res) => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d.slice(0, 100) }));
        });
        req.on('error', reject); req.end();
    });
}

async function main() {
    const paths = ['/api/reports/faculty', '/api/reports/room', '/api/reports/course', '/api/reports/batch', '/api/analysis/slots?day=Monday&periods=1%2C2', '/api/analytics/room-utilization', '/api/analytics/course-load', '/api/reports/courses-list'];
    for (const p of paths) {
        try {
            const r = await get(p);
            console.log(`${r.status === 200 ? '✅' : '❌'} [${r.status}] ${p.split('?')[0]}`);
        } catch (e) { console.log(`❌ ${p.split('?')[0]}: ${e.message}`); }
    }
}
main().catch(console.error);
