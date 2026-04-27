const mongoose = require('mongoose');
const { getTenantModels } = require('./utils/tenantManager');
const Institution = require('./models/Institution');
require('dotenv').config();

async function checkAttendance() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to Main DB');

        const insts = await Institution.find();
        for (const inst of insts) {
            console.log(`\nChecking Institution: ${inst.name} (${inst.slug})`);
            const models = await getTenantModels(inst.slug);
            const attendanceCount = await models.Attendance.countDocuments();
            console.log(`Total Attendance Records: ${attendanceCount}`);

            if (attendanceCount > 0) {
                const sample = await models.Attendance.find().limit(1).lean();
                console.log('Sample Record:', JSON.stringify(sample[0], null, 2));
                
                const student = await models.User.findById(sample[0].studentId);
                console.log('Student for sample:', student ? student.username : 'NOT FOUND');
                
                console.log('Record StudentId Type:', typeof sample[0].studentId, sample[0].studentId.constructor.name);
                console.log('Record InstitutionId Type:', typeof sample[0].institutionId, sample[0].institutionId.constructor.name);
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkAttendance();
