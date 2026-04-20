const mongoose = require('mongoose');
const Institution = require('./models/Institution');
require('dotenv').config();

async function init() {
    try {
        const uri = process.env.MONGODB_URI;
        console.log('Connecting to:', uri);
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const instId = '69884fc9b7b03d132ba7f832';

        let inst = await Institution.findById(instId);
        if (!inst) {
            console.log('Institution not found, creating...');
            inst = new Institution({
                _id: new mongoose.Types.ObjectId(instId),
                name: 'The User Institution',
                code: 'USER01',
                address: 'User Specified Location',
                contact: 'user@example.com'
            });
            await inst.save();
            console.log('Created Institution with ID:', instId);
        } else {
            console.log('Institution already exists with ID:', instId);
        }

        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

init();
