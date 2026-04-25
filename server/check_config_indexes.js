const mongoose = require('mongoose');
require('dotenv').config();

async function checkIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('timetableconfigs');
        
        const indexes = await collection.indexes();
        console.log('Indexes on timetableconfigs:', JSON.stringify(indexes, null, 2));

        const docs = await collection.find({}).toArray();
        console.log('Sample documents:', JSON.stringify(docs.slice(0, 2), null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkIndexes();
