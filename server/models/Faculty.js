const mongoose = require('mongoose');

const FacultySchema = new mongoose.Schema({
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
  facultyId: String,
  name: String,
  department: String,
  email: String,
  maxWeeklyLoad: { type: Number, default: 20 }
});

module.exports = mongoose.model('Faculty', FacultySchema);
