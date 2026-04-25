const mongoose = require('mongoose');
const UserRegistry = require('./models/User');
require('dotenv').config();

const inspectUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const User = UserRegistry.getUserModel(mongoose.connection);
        const users = await User.find({}, 'username role institutionId');
        console.log('Current Users in DB:');
        users.forEach(u => {
            console.log(`- Username: ${u.username}, Role: ${u.role}, Institution: ${u.institutionId}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

inspectUsers();
