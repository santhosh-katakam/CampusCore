const mongoose = require('mongoose');
const Course = require('./models/Course');
const Batch = require('./models/Batch');
require('dotenv').config();

async function checkLinkage() {
    await mongoose.connect(process.env.MONGODB_URI);
    const instId = "69884fc9b7b03d132ba7f832";
    
    console.log("--- BATCH TABLE ---");
    const batches = await Batch.find({ institutionId: instId });
    const batchNames = batches.map(b => b.name || b.batchId);
    console.log("Unique Batch Names in Batch table:", [...new Set(batchNames)].slice(0, 10), "...");
    
    console.log("\n--- COURSE TABLE ---");
    const courses = await Course.find({ institutionId: instId });
    const courseBatches = courses.map(c => c.batch);
    console.log("Unique Batch Names in Course table:", [...new Set(courseBatches)].slice(0, 10), "...");
    
    // Check for a specific one from the screenshot
    const search = "23CSBTB12";
    console.log(`\nSearching for courses matching batch: "${search}"`);
    const matching = await Course.find({ institutionId: instId, batch: search });
    console.log(`Found ${matching.length} matching courses.`);
    
    if (matching.length === 0) {
        console.log("Looking for partial matches...");
        const partial = await Course.find({ institutionId: instId, batch: new RegExp(search, 'i') });
        console.log(`Found ${partial.length} partial matches:`, partial.map(p => p.batch).slice(0, 5));
    }

    process.exit();
}

checkLinkage();
