const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema({
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
  batchId: String,
  semester: String,
  degree: String,
  yearLabel: String,
  department: String,
  session: String
});

module.exports = mongoose.model('Batch', BatchSchema);
