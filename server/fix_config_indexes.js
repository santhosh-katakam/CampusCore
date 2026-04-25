const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('timetableconfigs');

        // Drop the old unique index on 'session'
        try {
            await collection.dropIndex('session_1');
            console.log('Dropped unique index session_1');
        } catch (e) {
            console.log('Index session_1 not found or already dropped');
        }

        // Create new compound unique index on { session, institutionId }
        await collection.createIndex({ session: 1, institutionId: 1 }, { unique: true });
        console.log('Created compound unique index on { session, institutionId }');

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

fixIndexes();
