const mongoose = require('mongoose');
const Institution = require('./models/Institution');
require('dotenv').config();

const fixInstitutions = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/CampusCore');
        console.log('Connected to DB');

        const institutions = await Institution.find({ slug: { $exists: false } });
        console.log(`Found ${institutions.length} institutions without slugs`);

        for (const inst of institutions) {
            const slug = (inst.code || inst.name).toLowerCase().replace(/[^a-z0-9]/g, '');
            inst.slug = slug;
            await inst.save();
            console.log(`Added slug "${slug}" to ${inst.name}`);
        }

        console.log('Done');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

fixInstitutions();
