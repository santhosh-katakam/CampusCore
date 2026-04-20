const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    slotGroup: { type: String, enum: ['A', 'B', null], default: null },
});

module.exports = mongoose.model('Subject', SubjectSchema);
