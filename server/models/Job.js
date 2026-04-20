const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    company: { type: String, required: true },
    description: String,
    location: String,
    salary: String,
    link: { type: String, required: true },
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postedByName: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', JobSchema);
