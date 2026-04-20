const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/timetable_db', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Fail fast if not connected
        });

        console.log(`\x1b[36m%s\x1b[0m`, `MongoDB Config: ${process.env.MONGODB_URI ? 'Atlas/Custom' : 'Local Fallback'}`);
        console.log(`\x1b[32m%s\x1b[0m`, `MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {
        console.error(`\x1b[31m%s\x1b[0m`, `Error: ${error.message}`);

        if (error.name === 'MongooseServerSelectionError') {
            console.error('\x1b[33m%s\x1b[0m', 'Check your IP Whitelist in MongoDB Atlas or your internet connection.');
        }

        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;
