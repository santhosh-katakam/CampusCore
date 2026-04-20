const mongoose = require('mongoose');
require('dotenv').config();
const LMSCourse = require('./models/LMSCourse');
const Assignment = require('./models/Assignment');
const Quiz = require('./models/Quiz');

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");

        const courses = await LMSCourse.find({});
        console.log(`Found ${courses.length} courses`);

        for (const course of courses) {
            console.log(`Course: ${course.title} (${course._id})`);
            for (const mod of course.modules) {
                console.log(`  Module: ${mod.title} (${mod._id})`);
                console.log(`    Assignments: ${mod.assignments.length}`);
                console.log(`    Quizzes: ${mod.quizzes.length}`);
                
                // Try to find one quiz from this module
                if (mod.quizzes.length > 0) {
                    const quiz = await Quiz.findById(mod.quizzes[0]);
                    console.log(`    First Quiz Check: ${quiz ? quiz.title : 'NOT FOUND IN DB'}`);
                }
            }
        }

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
