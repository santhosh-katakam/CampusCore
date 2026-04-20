require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./server/models/User');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/timetablesystem';

async function verify() {
    try {
        await mongoose.connect(dbUri);
        console.log('Connected to DB');
        const user = await User.findOne({ role: 'COMPANY_ADMIN' });
        if (!user) {
            console.log('No COMPANY_ADMIN found!');
        } else {
            console.log('User found:', user.username);
            const isMatch = await user.comparePassword('password123');
            console.log('Password match (password123):', isMatch);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

verify();
