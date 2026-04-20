const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['Present', 'Absent', 'Late'], required: true },
    session: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attendance', AttendanceSchema);
