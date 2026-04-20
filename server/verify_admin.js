require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/timetablesystem';

async function verify() {
    try {
        await mongoose.connect(dbUri);
        console.log('Connected to DB');
        const user = await User.findOne({ username: 'company_admin' });
        if (!user) {
            console.log('No user found with username company_admin');
        } else {
            console.log('User Details:', JSON.stringify(user, null, 2));
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
