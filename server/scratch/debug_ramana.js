const mongoose = require('mongoose');
const { getTenantModels } = require('../utils/tenantManager');
require('dotenv').config();

async function debugRamana() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const { User, Attendance } = await getTenantModels('priyadarshini-collage');
        
        const ramana = await User.findOne({ username: 'ramana' });
        if (!ramana) {
            console.log('User ramana NOT FOUND in tenant priyadarshini-collage');
            return;
        }
        console.log(`User ramana found: ID=${ramana._id}, Name=${ramana.name}`);
        
        const records = await Attendance.find({ studentId: ramana._id });
        console.log(`Found ${records.length} records by ID.`);
        
        const allRecords = await Attendance.find({}).populate('studentId', 'name username');
        console.log('All records in tenant:');
        allRecords.forEach(r => {
            console.log(`- ID: ${r._id}, studentId: ${r.studentId?._id}, Name: ${r.studentId?.name}, username: ${r.studentId?.username}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debugRamana();
