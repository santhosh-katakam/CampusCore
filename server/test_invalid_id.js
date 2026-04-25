const axios = require('axios');

async function testSave() {
    const session = '2025-26-Even';
    const institutionId = 'null'; // simulating a common frontend bug
    const url = `http://localhost:4000/api/timetable-advanced/config/${session}`;
    
    const data = {
        periodsPerDay: 8,
        periodDuration: 60,
        startTime: '09:00',
        endTime: '17:00',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        lunchBreak: {
            enabled: true,
            period: 1, 
            duration: 60
        }
    };

    try {
        const response = await axios.put(url, data, {
            headers: {
                'x-institution-id': institutionId
            }
        });
        console.log('Success:', response.data);
    } catch (err) {
        console.error('Error Status:', err.response?.status);
        console.error('Error Data:', JSON.stringify(err.response?.data, null, 2));
    }
}

testSave();
