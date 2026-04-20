const mongoose = require('mongoose');
const Course = require('./models/Course');
const User = require('./models/User');
require('dotenv').config();

const inspect = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('--- Inspecting Database ---');
        
        const courses = await Course.find({}).limit(5);
        console.log('Sample Courses:', JSON.stringify(courses, null, 2));
        
        const users = await User.find({ role: 'FACULTY' }).limit(5);
        console.log('Faculty Users:', JSON.stringify(users, null, 2));

        const ruthlessUser = await User.findOne({ username: 'ruthwik' });
        console.log('Ruthwik User:', JSON.stringify(ruthlessUser, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

inspect();
