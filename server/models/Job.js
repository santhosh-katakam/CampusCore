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

const getJobModel = (connection) => {
    return connection.models.Job || connection.model('Job', JobSchema);
};

module.exports = { JobSchema, getJobModel };
