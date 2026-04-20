const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkStudents() {
    await mongoose.connect(process.env.MONGODB_URI);
    const instId = "69884fc9b7b03d132ba7f832";
    
    const students = await User.find({ institutionId: instId, role: 'STUDENT' });
    const studentBatches = students.map(s => s.batch);
    console.log("Unique Student Batch Strings:", [...new Set(studentBatches)].slice(0, 10));
    
    process.exit();
}

checkStudents();
