const mongoose = require('mongoose');
const { getUserModel } = require('../models/User');
const { getTenantModels } = require('../utils/tenantManager');
const Institution = require('../models/Institution');
require('dotenv').config();

async function checkUserIds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const MainUser = getUserModel(mongoose.connection);
        const institutions = await Institution.find({});

        for (const inst of institutions) {
            if (!inst.slug) continue;
            console.log(`\n--- Checking Tenant: ${inst.slug} ---`);
            const { User: TenantUser } = await getTenantModels(inst.slug);
            
            const tenantUsers = await TenantUser.find({ role: 'STUDENT' }).limit(10);
            for (const tu of tenantUsers) {
                const mu = await MainUser.findOne({ username: tu.username });
                if (mu) {
                    const match = mu._id.toString() === tu._id.toString();
                    console.log(`User: ${tu.username}, TenantID: ${tu._id}, MainID: ${mu._id}, Match: ${match}`);
                } else {
                    console.log(`User: ${tu.username}, NOT FOUND in Main DB`);
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkUserIds();
