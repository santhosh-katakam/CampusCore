require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/timetablesystem';

async function verify() {
    try {
        await mongoose.connect(dbUri);
        console.log('Connected to DB');
        const students = await User.find({ role: 'STUDENT' }).limit(5);
        console.log('Sample Students Data:');
        students.forEach(s => {
            console.log(`- ${s.username}: Batch="${s.batch}", Dept="${s.department}"`);
        });
        
        const batches = await User.distinct('batch', { role: 'STUDENT' });
        console.log('Unique Student Batches in DB:', batches);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

verify();
