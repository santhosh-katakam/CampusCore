const mongoose = require('mongoose');
const Institution = require('./models/Institution');
require('dotenv').config();

async function inspectInstitutions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const institutions = await Institution.find({});
        console.log('Current Institutions in DB:');
        institutions.forEach(i => {
            console.log(`- Name: ${i.name}, Code: ${i.code}, Slug: ${i.slug}, ID: ${i._id}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectInstitutions();
