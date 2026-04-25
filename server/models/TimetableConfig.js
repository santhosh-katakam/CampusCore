const mongoose = require('mongoose');

const TimetableConfigSchema = new mongoose.Schema({
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    session: { type: String, required: true },
    periodsPerDay: { type: Number, required: true, default: 8 },
    periodDuration: { type: Number, required: true, default: 60 }, // in minutes
    startTime: { type: String, required: true, default: '09:00' }, // HH:MM format
    endTime: { type: String, required: true, default: '17:00' }, // HH:MM format
    workingDays: {
        type: [String],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    lunchBreak: {
        enabled: { type: Boolean, default: true },
        period: { type: Number, default: 4 }, // Which period number
        duration: { type: Number, default: 60 } // in minutes
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const getTimetableConfigModel = (connection) => {
    return connection.models.TimetableConfig || connection.model('TimetableConfig', TimetableConfigSchema);
};

module.exports = { TimetableConfigSchema, getTimetableConfigModel };
