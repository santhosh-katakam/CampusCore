/**
 * Migration Script: Stamp all existing records that have no institutionId
 * with the default institution ID.
 *
 * Run once: node migrate_institution_id.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const INSTITUTION_ID = new mongoose.Types.ObjectId(
    process.env.DEFAULT_INSTITUTION_ID || '69884fc9b7b03d132ba7f832'
);

const MONGODB_URI = process.env.MONGODB_URI;

const modelDefs = [
    { name: 'Faculty', path: './models/Faculty' },
    { name: 'Room', path: './models/Room' },
    { name: 'Batch', path: './models/Batch' },
    { name: 'Subject', path: './models/Subject' },
    { name: 'Course', path: './models/Course' },
    { name: 'Timetable', path: './models/Timetable' },
    { name: 'TimetableConfig', path: './models/TimetableConfig' },
];

async function migrate() {
    console.log(`\n🔗  Connecting to MongoDB…`);
    await mongoose.connect(MONGODB_URI);
    console.log(`✅  Connected: ${mongoose.connection.host}`);
    console.log(`🏷️   Stamping records with institutionId = ${INSTITUTION_ID}\n`);

    for (const { name, path } of modelDefs) {
        try {
            const Model = require(path);

            // Only match documents where institutionId is literally absent or null
            // (avoid casting '', undefined, etc.)
            const filter = {
                $or: [
                    { institutionId: { $exists: false } },
                    { institutionId: null }
                ]
            };

            const count = await Model.countDocuments(filter);

            if (count === 0) {
                console.log(`  ☑️  ${name}: no untagged records – skipping`);
                continue;
            }

            const result = await Model.updateMany(filter, {
                $set: { institutionId: INSTITUTION_ID }
            });

            console.log(`  ✅  ${name}: ${result.modifiedCount} / ${count} records updated`);
        } catch (err) {
            console.error(`  ❌  ${name}: ${err.message}`);
        }
    }

    await mongoose.disconnect();
    console.log('\n🎉  Migration complete. Database connection closed.\n');
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
