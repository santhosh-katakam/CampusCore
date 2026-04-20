const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

async function resetPasswords() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const targets = ['john', 'sam', 'king'];
        
        for (const username of targets) {
            // Case insensitive search
            const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
            if (user) {
                user.password = '123456';
                await user.save();
                console.log(`Password reset for ${user.username} to "123456"`);
            } else {
                console.log(`User not found: ${username}`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

resetPasswords();
