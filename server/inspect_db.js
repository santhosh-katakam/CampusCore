require('dotenv').config();
const mongoose = require('mongoose');
const Batch = require('./models/Batch');
const Course = require('./models/Course');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const batches = await Batch.find({ institutionId: '69884fc9b7b03d132ba7f832' }).limit(5);
    console.log('BATCHES:', JSON.stringify(batches, null, 2));
    const courses = await Course.find({ institutionId: '69884fc9b7b03d132ba7f832' }).limit(3);
    console.log('COURSES:', JSON.stringify(courses, null, 2));
    await mongoose.disconnect();
}
main().catch(console.error);
