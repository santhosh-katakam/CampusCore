const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctOption: { type: Number, required: true }, // Index of the correct option
    marks: { type: Number, default: 1 }
});

const QuizSchema = new mongoose.Schema({
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'LMSCourse', required: true },
    moduleId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    description: String,
    timeLimit: { type: Number, default: 30 }, // in minutes
    questions: [QuestionSchema],
    createdAt: { type: Date, default: Date.now }
});

const getQuizModel = (connection) => {
    return connection.models.Quiz || connection.model('Quiz', QuizSchema);
};

module.exports = { QuizSchema, getQuizModel };
