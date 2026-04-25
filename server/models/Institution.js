const mongoose = require('mongoose');

const InstitutionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true }, // Used for separate collections
    address: String,
    contact: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Institution', InstitutionSchema);
