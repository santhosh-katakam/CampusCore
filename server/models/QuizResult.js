const mongoose = require('mongoose');

const QuizResultSchema = new mongoose.Schema({
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    answers: [{ questionId: mongoose.Schema.Types.ObjectId, selectedOption: Number, isCorrect: Boolean }],
    completedAt: { type: Date, default: Date.now }
});

const getQuizResultModel = (connection) => {
    return connection.models.QuizResult || connection.model('QuizResult', QuizResultSchema);
};

module.exports = { QuizResultSchema, getQuizResultModel };
