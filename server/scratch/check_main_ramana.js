const mongoose = require('mongoose');
const { getUserModel } = require('../models/User');
require('dotenv').config();

async function checkMainUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const MainUser = getUserModel(mongoose.connection);
        
        const ramana = await MainUser.findOne({ username: 'ramana' });
        console.log(`Main User ramana: ID=${ramana ? ramana._id : 'NOT FOUND'}`);
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkMainUser();
