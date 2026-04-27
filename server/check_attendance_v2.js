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
                const sample = await models.Attendance.findOne().lean();
                console.log('Sample Attendance Record:', JSON.stringify(sample, null, 2));
                
                const student = await models.User.findById(sample.studentId);
                if (student) {
                    console.log(`Student: ${student.name} (${student.username})`);
                    console.log(`Student InstitutionId in User doc: ${student.institutionId}`);
                    console.log(`Attendance Record InstitutionId: ${sample.institutionId}`);
                    console.log(`Are they equal? ${student.institutionId.toString() === sample.institutionId.toString()}`);
                } else {
                    console.log('Student NOT FOUND in Tenant DB');
                }
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkAttendance();
