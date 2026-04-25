/**
 * FULL MULTI-DB MIGRATION SCRIPT
 * 
 * This script moves data from the "Shared Dump" database to separate databases
 * based on the Institution's slug.
 * 
 * Usage: node scripts/full_multi_db_migration.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getTenantConnection, getTenantModels } = require('../utils/tenantManager');

// Main Models (Still on global mongoose connection)
const Institution = require('../models/Institution');

// Registry of models to migrate
const modelRegistry = [
    { name: 'User', helper: require('../models/User').getUserModel },
    { name: 'Batch', helper: require('../models/Batch').getBatchModel },
    { name: 'Course', helper: require('../models/Course').getCourseModel },
    { name: 'Faculty', helper: require('../models/Faculty').getFacultyModel },
    { name: 'Room', helper: require('../models/Room').getRoomModel },
    { name: 'Subject', helper: require('../models/Subject').getSubjectModel },
    { name: 'Timetable', helper: require('../models/Timetable').getTimetableModel },
    { name: 'TimetableConfig', helper: require('../models/TimetableConfig').getTimetableConfigModel },
    { name: 'Attendance', helper: require('../models/Attendance').getAttendanceModel },
    { name: 'LMSCourse', helper: require('../models/LMSCourse').getLMSCourseModel },
    { name: 'Assignment', helper: require('../models/Assignment').getAssignmentModel },
    { name: 'Quiz', helper: require('../models/Quiz').getQuizModel },
    { name: 'QuizResult', helper: require('../models/QuizResult').getQuizResultModel },
    { name: 'Job', helper: require('../models/Job').getJobModel },
    { name: 'Submission', helper: require('../models/Submission').getSubmissionModel },
];

async function migrate() {
    console.log('🚀 Starting Multi-DB Migration...');
    
    // 1. Connect to Main DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to Main DB');

    // 2. Get all institutions
    const institutions = await Institution.find({});
    console.log(`📂 Found ${institutions.length} institutions to process.`);

    for (const inst of institutions) {
        if (!inst.slug) {
            console.warn(`⚠️  Institution ${inst.name} has no slug. Skipping.`);
            continue;
        }

        console.log(`\n--- Processing Institution: ${inst.name} [${inst.slug}] ---`);

        // 3. Get Tenant Models
        const tenantModels = await getTenantModels(inst.slug);

        for (const meta of modelRegistry) {
            try {
                const MainModel = meta.helper(mongoose.connection);
                const TenantModel = tenantModels[meta.name];

                // Find records for this institution
                let filter = { institutionId: inst._id };
                
                // Special handling for child models that don't have institutionId
                if (['Assignment', 'Quiz'].includes(meta.name)) {
                    const LMSCourse = require('../models/LMSCourse').getLMSCourseModel(mongoose.connection);
                    const instCourses = await LMSCourse.find({ institutionId: inst._id }).select('_id');
                    const courseIds = instCourses.map(c => c._id);
                    filter = { courseId: { $in: courseIds } };
                } else if (['QuizResult', 'Submission'].includes(meta.name)) {
                    // For simplicity, we assume studentId belongs to this institution
                    // In a perfect world, we'd check the student's institutionId
                    const User = require('../models/User').getUserModel(mongoose.connection);
                    const instUsers = await User.find({ institutionId: inst._id }).select('_id');
                    const userIds = instUsers.map(u => u._id);
                    filter = { studentId: { $in: userIds } };
                }

                const records = await MainModel.find(filter);
                
                if (records.length === 0) {
                    console.log(`  ▫️ ${meta.name}: 0 records.`);
                    continue;
                }

                // Insert into Tenant DB
                // Use insertMany to be fast, and skip if already exists (check by _id)
                const existingIds = await TenantModel.find({ _id: { $in: records.map(r => r._id) } }).select('_id');
                const existingIdSet = new Set(existingIds.map(e => e._id.toString()));
                
                const toInsert = records.filter(r => !existingIdSet.has(r._id.toString()));

                if (toInsert.length > 0) {
                    await TenantModel.insertMany(toInsert);
                    console.log(`  ✅ ${meta.name}: Migrated ${toInsert.length} / ${records.length} records.`);
                } else {
                    console.log(`  ☑️ ${meta.name}: All ${records.length} records already migrated.`);
                }

            } catch (err) {
                console.error(`  ❌ Error migrating ${meta.name}:`, err.message);
            }
        }
    }

    console.log('\n✨ Migration finished.');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
