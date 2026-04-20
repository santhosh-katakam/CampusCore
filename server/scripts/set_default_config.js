const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const TimetableConfig = require('../models/TimetableConfig');
require('dotenv').config({ path: '.env' });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected for Script');
    } catch (err) {
        console.error('Database connection error:', err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    try {
        // 1. Get all unique sessions from Batches
        const batches = await Batch.find({});
        const sessions = [...new Set(batches.map(b => b.session).filter(s => s))];
        console.log(`Found ${sessions.length} unique sessions:`, sessions);

        for (const session of sessions) {
            // 2. Check if Config exists
            const existingConfig = await TimetableConfig.findOne({ session });
            if (existingConfig) {
                console.log(`Config already exists for session ${session}. Skipping.`);
                continue;
            }

            // 3. Create Default Config (8 periods * 5 days = 40 slots)
            const newConfig = new TimetableConfig({
                session,
                periodsPerDay: 8,
                periodDuration: 60,
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                lunchBreak: {
                    enabled: true,
                    period: 4, // 4th period (e.g., 12:00-1:00)
                    duration: 60
                },
                startTime: '09:00',
                endTime: '17:00'
            });

            await newConfig.save();
            console.log(`CREATED default config for session ${session} (8 periods/day, 5 days)`);
        }

        console.log('Script completed successfully.');
    } catch (error) {
        console.error('Error running script:', error);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
};

run();
