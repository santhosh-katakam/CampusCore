const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
    type: { type: String, enum: ['video', 'pdf', 'link'], required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const ModuleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    week: { type: Number, required: true },
    materials: [MaterialSchema],
    assignments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' }],
    quizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }]
});

const LMSCourseSchema = new mongoose.Schema({
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: String,
    category: String,
    department: String,
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    modules: [ModuleSchema],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LMSCourse', LMSCourseSchema);
