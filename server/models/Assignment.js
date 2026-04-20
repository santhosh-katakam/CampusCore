const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'LMSCourse', required: true },
    moduleId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    description: String,
    dueDate: { type: Date, required: true },
    maxMarks: { type: Number, required: true },
    attachments: [{ title: String, url: String }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Assignment', AssignmentSchema);
