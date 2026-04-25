const mongoose = require('mongoose');
require('dotenv').config();

// Import Model Generators
const { getBatchModel } = require('../models/Batch');
const { getCourseModel } = require('../models/Course');
const { getFacultyModel } = require('../models/Faculty');
const { getRoomModel } = require('../models/Room');
const { getSubjectModel } = require('../models/Subject');
const { getTimetableModel } = require('../models/Timetable');
const { getTimetableConfigModel } = require('../models/TimetableConfig');
const { getAssignmentModel } = require('../models/Assignment');
const { getAttendanceModel } = require('../models/Attendance');
const { getLMSCourseModel } = require('../models/LMSCourse');
const { getQuizModel } = require('../models/Quiz');
const { getQuizResultModel } = require('../models/QuizResult');
const { getJobModel } = require('../models/Job');
const { getSubmissionModel } = require('../models/Submission');
const { getUserModel } = require('../models/User');

const connectionCache = {};
const modelsCache = {};

/**
 * Returns a database connection for a specific tenant.
 */
const getTenantConnection = async (slug) => {
    if (!slug) throw new Error('Tenant slug is required');

    if (connectionCache[slug] && connectionCache[slug].readyState === 1) {
        return connectionCache[slug];
    }

    const baseUri = (process.env.MONGODB_URI || 'mongodb://localhost:27017/').split('?')[0].replace(/\/$/, "");
    const lastSlashIndex = baseUri.lastIndexOf('/');
    const cleanBaseUri = baseUri.substring(0, lastSlashIndex + 1);
    const tenantDbUri = `${cleanBaseUri}campuscore_${slug}`;
    
    console.log(`📡 Connecting to Tenant DB: ${tenantDbUri}`);
    const conn = mongoose.createConnection(tenantDbUri);
    connectionCache[slug] = conn;
    return conn;
};

/**
 * Returns the models collection for a specific tenant.
 * Compiles models on the tenant's specific connection.
 */
const getTenantModels = async (slug) => {
    if (modelsCache[slug]) return modelsCache[slug];

    const conn = await getTenantConnection(slug);
    
    const models = {
        Batch: getBatchModel(conn),
        Course: getCourseModel(conn),
        Faculty: getFacultyModel(conn),
        Room: getRoomModel(conn),
        Subject: getSubjectModel(conn),
        Timetable: getTimetableModel(conn),
        TimetableConfig: getTimetableConfigModel(conn),
        Assignment: getAssignmentModel(conn),
        Attendance: getAttendanceModel(conn),
        LMSCourse: getLMSCourseModel(conn),
        Quiz: getQuizModel(conn),
        QuizResult: getQuizResultModel(conn),
        Job: getJobModel(conn),
        Submission: getSubmissionModel(conn),
        User: getUserModel(conn)
    };

    modelsCache[slug] = models;
    return models;
};

module.exports = { getTenantConnection, getTenantModels };
