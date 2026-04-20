const mongoose = require('mongoose');

const TimetableSchema = new mongoose.Schema({
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
  title: String,
  year: String,
  batchId: String,
  generatedAt: { type: Date, default: Date.now },
  config: mongoose.Schema.Types.Mixed,
  timetable: mongoose.Schema.Types.Mixed,
  schedule: mongoose.Schema.Types.Mixed,
  facultySummary: mongoose.Schema.Types.Mixed,
  roomSummary: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  batch: String
});

module.exports = mongoose.model('Timetable', TimetableSchema);
