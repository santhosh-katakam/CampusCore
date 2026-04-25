const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['COMPANY_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'FACULTY', 'STUDENT'], required: true },
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
    name: String,
    email: String,
    department: String,
    batch: String,
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const getUserModel = (connection) => {
    return connection.models.User || connection.model('User', UserSchema);
};

module.exports = { UserSchema, getUserModel };
