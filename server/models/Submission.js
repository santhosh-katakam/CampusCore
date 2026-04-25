const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: String, // Link or text
    fileUrl: String,
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['submitted', 'graded', 'late'], default: 'submitted' },
    grade: { type: Number, default: null },
    feedback: String
});

const getSubmissionModel = (connection) => {
    return connection.models.Submission || connection.model('Submission', SubmissionSchema);
};

module.exports = { SubmissionSchema, getSubmissionModel };
