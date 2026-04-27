const mongoose = require('mongoose');
const { getTenantModels } = require('../utils/tenantManager');
require('dotenv').config();

async function checkStudent() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const { User, Attendance } = await getTenantModels('priyadarshini-collage');
        
        const studentId = '69edf2338a56768b37da1b10';
        const student = await User.findById(studentId);
        console.log(`Student found in tenant: ${student ? student.username : 'NO'}`);
        
        const attendance = await Attendance.find({ studentId: new mongoose.Types.ObjectId(studentId) });
        console.log(`Attendance count in tenant: ${attendance.length}`);
        
        const allAttendance = await Attendance.find({}).limit(5);
        console.log('Sample attendance studentIds:');
        allAttendance.forEach(a => console.log(`- ${a.studentId}`));
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkStudent();
