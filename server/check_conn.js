const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to:', mongoose.connection.host);
        process.exit(0);
    } catch (err) {
        console.error('Failed:', err.message);
        process.exit(1);
    }
}
check();
