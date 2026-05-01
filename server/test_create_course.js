const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your_super_secret_jwt_key_123';
const token = jwt.sign({
    id: '662b6f123456789012345678',
    role: 'HOD',
    institutionId: '69884fc9b7b03d132ba7f832',
    username: 'test_hod'
}, JWT_SECRET, { expiresIn: '24h' });

async function test() {
    try {
        const res = await axios.post('http://localhost:4000/api/lms/courses', {
            title: 'Test Course',
            description: 'Test',
            category: 'Tech',
            department: 'CSE',
            institutionId: '69884fc9b7b03d132ba7f832'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Success:', res.data);
    } catch (err) {
        console.log('Error:', err.response ? err.response.status + ' ' + JSON.stringify(err.response.data) : err.message);
    }
}

test();
