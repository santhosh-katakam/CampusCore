const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    facultyId: { type: String, required: true },
    facultyName: { type: String, required: true },
    courseCode: { type: String, required: true },
    subject: { type: String, required: true },
    type: { type: String, enum: ['Core', 'Elective'], required: true },
    batch: { type: String, required: true },
    courseL: { type: Number, default: 0 }, // Lecture hours
    courseT: { type: Number, default: 0 }, // Tutorial hours
    courseP: { type: Number, default: 0 }, // Practical hours
    credits: { type: Number, required: true },
    year: { type: String, required: true }, // First Year, Second Year, etc.
    semester: { type: Number, required: true },
    program: { type: String, required: true }, // B.Tech, M.Tech, etc.
    department: { type: String, required: true }, // CSE, ECE, etc.
    facultyL: { type: Number, default: 0 }, // Faculty lecture load
    facultyT: { type: Number, default: 0 }, // Faculty tutorial load
    facultyP: { type: Number, default: 0 }, // Faculty practical load
    totalLoad: { type: Number, required: true },
    session: { type: String, required: true } // 2025-26-Even, etc.
});

const getCourseModel = (connection) => {
    return connection.models.Course || connection.model('Course', CourseSchema);
};

module.exports = { CourseSchema, getCourseModel };
