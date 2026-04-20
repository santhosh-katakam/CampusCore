const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const resetAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Delete any existing company_admin to ensure clean state
        await User.deleteOne({ username: 'company_admin' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        const admin = new User({
            username: 'company_admin',
            password: 'password123', // The pre-save hook will hash this AGAIN if we aren't careful
            role: 'COMPANY_ADMIN',
            name: 'Main Administrator',
            email: 'admin@company.com'
        });

        // Actually, the model has a pre-save hook. 
        // If I pass 'password123', it will hash it.
        // If I pass a hashed password, the hook might hash it again unless it checks isModified.
        // The hook checks isModified('password'), which is true for new docs.
        
        await admin.save();
        console.log('Company Admin re-created successfully!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

resetAdmin();
