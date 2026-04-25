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

const getBatchModel = (connection) => {
  return connection.models.Batch || connection.model('Batch', BatchSchema);
};

module.exports = { BatchSchema, getBatchModel };
