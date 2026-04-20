const mongoose = require('mongoose');
const LMSCourse = require('./models/LMSCourse');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

async function checkLmsState() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const courses = await LMSCourse.find({});
        console.log(`Found ${courses.length} courses in DB`);

        for (const course of courses) {
            console.log(`Course: "${course.title}" (ID: ${course._id})`);
            console.log(` - Enrolled Students: ${course.students.length}`);
            const students = await User.find({ _id: { $in: course.students } });
            students.forEach(s => console.log(`   * ${s.username} (${s.role})`));
        }

        const santhosh = await User.findOne({ username: 'santhosh' });
        if (santhosh) {
            console.log(`\nUser "santhosh" ID: ${santhosh._id}`);
            
            for (const course of courses) {
                if (course.students.includes(santhosh._id)) {
                    console.log(`Checking content for santhosh in "${course.title}":`);
                    course.modules.forEach(m => {
                        console.log(` - Module: ${m.title} (ID: ${m._id})`);
                        console.log(`   * Materials: ${m.materials.map(mat => mat.title).join(', ')}`);
                        console.log(`   * Assignments: ${m.assignments.length}`); // IDs only
                        console.log(`   * Quizzes: ${m.quizzes.length}`); // IDs only
                    });
                }
            }
        } else {
            console.log('User "santhosh" not found');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkLmsState();
