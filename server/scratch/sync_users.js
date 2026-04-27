const mongoose = require('mongoose');
const { getUserModel } = require('../models/User');
const { getTenantModels } = require('../utils/tenantManager');
const Institution = require('../models/Institution');
require('dotenv').config();

async function syncAllUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const MainUser = getUserModel(mongoose.connection);
        const institutions = await Institution.find({});

        for (const inst of institutions) {
            if (!inst.slug) continue;
            console.log(`\n--- Syncing Tenant: ${inst.slug} ---`);
            const { User: TenantUser } = await getTenantModels(inst.slug);
            
            const mainUsers = await MainUser.find({ institutionId: inst._id });
            console.log(`Found ${mainUsers.length} users in Main DB for this institution.`);

            let syncedCount = 0;
            for (const mu of mainUsers) {
                const tu = await TenantUser.findOne({ username: mu.username });
                if (!tu) {
                    const newUser = new TenantUser({
                        _id: mu._id,
                        username: mu.username,
                        password: mu.password,
                        name: mu.name,
                        email: mu.email,
                        role: mu.role,
                        institutionId: mu.institutionId,
                        batch: mu.batch,
                        department: mu.department,
                        isActive: mu.isActive
                    });
                    await newUser.save();
                    syncedCount++;
                }
            }
            console.log(`Synced ${syncedCount} missing users to tenant.`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

syncAllUsers();
