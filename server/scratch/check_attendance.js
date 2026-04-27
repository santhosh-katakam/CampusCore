const mongoose = require('mongoose');
const { getTenantModels } = require('../utils/tenantManager');
const Institution = require('../models/Institution');
require('dotenv').config();

async function checkAttendance() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const institutions = await Institution.find({});
        console.log('Institutions:', institutions.map(i => ({ id: i._id, name: i.name, slug: i.slug })));

        for (const inst of institutions) {
            if (!inst.slug) continue;
            console.log(`\n--- Checking Tenant: ${inst.slug} ---`);
            const { Attendance, User } = await getTenantModels(inst.slug);
            
            const count = await Attendance.countDocuments({});
            console.log(`Attendance count: ${count}`);
            
            if (count > 0) {
                const records = await Attendance.find({}).limit(5).populate('studentId', 'name username');
                console.log('Sample Records:');
                records.forEach(r => {
                    console.log(`- Date: ${r.date}, Student: ${r.studentId?.name || 'UNKNOWN'} (${r.studentId?._id || 'NO_ID'}), Status: ${r.status}`);
                    if (!r.studentId) {
                        console.log(`  Raw studentId in record: ${r.get('studentId')}`);
                    }
                });
                
                const firstRecord = await Attendance.findOne({});
                // console.log('Raw first record:', firstRecord);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkAttendance();
