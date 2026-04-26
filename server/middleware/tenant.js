const Institution = require('../models/Institution');
const { getTenantModels } = require('../utils/tenantManager');

module.exports = async (req, res, next) => {
    try {
        // 1. Identify the institution ID
        // Logic: Students are always locked to their own institution. 
        // Others (Admins/Faculty) can use the viewing header/query if provided.
        // We also check req.body for cases like login where it might be sent there.
        let institutionId = req.headers['x-institution-id'] || req.query.institutionId || req.body?.institutionId;
        
        if (req.user && req.user.role === 'STUDENT') {
            institutionId = req.user.institutionId;
        } else if (!institutionId && req.user) {
            institutionId = req.user.institutionId;
        }


        if (!institutionId) {

            // Fallback for global routes (like login/public inst lists) or if not provided
            return next();
        }

        // 2. Fetch the institution to get its slug
        // Note: Using a cache here would be much faster in production
        const inst = await Institution.findById(institutionId);
        
        if (!inst || !inst.slug) {
            console.warn(`Tenant middleware: No institution or slug found for ID ${institutionId}`);
            return next();
        }

        // 3. Attach prefixed models to the request object
        req.tenantSlug = inst.slug;
        req.tenantModels = await getTenantModels(inst.slug);
        
        next();
    } catch (err) {
        console.error('Tenant Middleware Error:', err);
        next();
    }
};
