const mongoose = require('mongoose');
require('dotenv').config();

async function checkBatches() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('batches');
        
        const docs = await collection.find({}).toArray();
        console.log('Batches:', JSON.stringify(docs.slice(0, 5), null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkBatches();
