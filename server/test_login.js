const axios = require('axios');

const testLogin = async () => {
    try {
        const res = await axios.post('http://localhost:4000/api/auth/login', {
            username: 'company_admin',
            password: 'password123'
        });
        console.log('Login successful!');
        console.log('User Role:', res.data.user.role);
        process.exit(0);
    } catch (err) {
        console.error('Login failed:', err.response?.data?.error || err.message);
        process.exit(1);
    }
};

testLogin();
