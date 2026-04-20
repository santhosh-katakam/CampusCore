const mongoose = require('mongoose');
const Course = require('./models/Course');
const Batch = require('./models/Batch');
require('dotenv').config();

async function checkAttendanceData() {
    await mongoose.connect(process.env.MONGODB_URI);
    const instId = "69884fc9b7b03d132ba7f832";
    
    console.log("Checking courses for institution:", instId);
    const courses = await Course.find({ institutionId: instId });
    console.log("Courses found:", courses.length);
    if (courses.length > 0) {
        console.log("First course batch:", courses[0].batch);
        console.log("First course year:", courses[0].year);
    }
    
    console.log("\nChecking batches for institution:", instId);
    const batches = await Batch.find({ institutionId: instId });
    console.log("Batches found:", batches.length);
    if (batches.length > 0) {
        console.log("First batch name:", batches[0].name);
    }
    
    process.exit();
}

checkAttendanceData();
