require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('batches');

        console.log('Checking indexes on "batches" collection...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        const hasNameIndex = indexes.some(idx => idx.name === 'name_1');
        if (hasNameIndex) {
            console.log('Found "name_1" index. Dropping it...');
            await collection.dropIndex('name_1');
            console.log('Successfully dropped "name_1" index.');
        } else {
            console.log('"name_1" index not found.');
        }

        // Just in case there are other unique indexes that shouldn't be there
        // (Wait, I should be careful not to drop important ones like _id)
        
        console.log('Indexes after cleanup:', JSON.stringify(await collection.indexes(), null, 2));

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
