const axios = require('axios');

async function testSaveConfig() {
    try {
        const res = await axios.put('http://localhost:4000/api/timetable-advanced/config/2025-26-Even', {
            periodsPerDay: 8,
            periodDuration: 60,
            startTime: '09:00',
            endTime: '17:00',
            workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            lunchBreak: { enabled: true, period: 4, duration: 60 }
        }, {
            headers: {
                'x-institution-id': '69884fc9b7b03d132ba7f832'
            }
        });
        console.log('Save Config Result:', res.data);
    } catch (err) {
        console.error('Save Config Failed:', err.response?.data || err.message);
    }
}

testSaveConfig();
