const mongoose = require('mongoose');
const { getTenantModels } = require('../utils/tenantManager');
const Institution = require('../models/Institution');
require('dotenv').config();

async function checkIds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const institutions = await Institution.find({});

        for (const inst of institutions) {
            if (!inst.slug) continue;
            console.log(`\n--- Checking Tenant: ${inst.slug} ---`);
            const { Attendance, User } = await getTenantModels(inst.slug);
            
            const firstAttendance = await Attendance.findOne({});
            if (firstAttendance) {
                console.log(`Attendance Record InstID: ${firstAttendance.institutionId}`);
                
                const student = await User.findById(firstAttendance.studentId);
                if (student) {
                    console.log(`Student (${student.username}) InstID: ${student.institutionId}`);
                    const match = firstAttendance.institutionId.toString() === student.institutionId.toString();
                    console.log(`Match: ${match}`);
                    
                    if (!match) {
                        console.log('MISMATCH FOUND!');
                    }
                } else {
                    console.log(`Student ID ${firstAttendance.studentId} NOT FOUND in tenant User collection`);
                }
            } else {
                console.log('No attendance records found');
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkIds();
