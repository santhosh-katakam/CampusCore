const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const TimetableConfig = require('../models/TimetableConfig');
const Scheduler = require('../utils/scheduler');
const excelRouter = require('./excelUpload');
const configRoutes = require('./configRoutes');
const promptGeneratorRouter = require('./promptGenerator');

// Models (Imported for Schema/Reference, but used dynamically)
const BatchRegistry = require('../models/Batch');
const FacultyRegistry = require('../models/Faculty');
const Room = require('../models/Room');
const Subject = require('../models/Subject');
const CourseRegistry = require('../models/Course');
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Institution = require('../models/Institution');

// Helper: Resolve the correct model based on tenancy
const getModels = (req) => {
  const models = req.tenantModels || {
    Batch: BatchRegistry.getBatchModel(mongoose.connection),
    Faculty: FacultyRegistry.getFacultyModel(mongoose.connection),
    Course: CourseRegistry.getCourseModel(mongoose.connection),
    Room: require('../models/Room').getRoomModel(mongoose.connection),
    Subject: require('../models/Subject').getSubjectModel(mongoose.connection),
    Timetable: require('../models/Timetable').getTimetableModel(mongoose.connection),
    TimetableConfig: require('../models/TimetableConfig').getTimetableConfigModel(mongoose.connection),
    User: require('../models/User').getUserModel(mongoose.connection)
  };
  return models;
};

// Mount Sub-Routers
router.use('/excel', excelRouter);
router.use('/timetable-advanced', configRoutes);
router.use('/generate-from-prompts', promptGeneratorRouter);

// Helper: extract institution id from request
const getInstitutionId = (req) => {
  if (req.user && req.user.institutionId) return req.user.institutionId;
  const id = req.headers['x-institution-id'];
  if (!id || id === 'null' || id === 'undefined' || id === '') {
    return process.env.DEFAULT_INSTITUTION_ID;
  }
  return id;
};

// Helper: Get the query filter based on user role
const getInstFilter = (req) => {
  // If Company Admin, they can see everything unless a specific institution is requested
  if (req.user && req.user.role === 'COMPANY_ADMIN') {
    const requestedId = req.headers['x-institution-id'] || req.query.institutionId;
    return requestedId ? { institutionId: requestedId } : {};
  }
  // Otherwise, strictly filter by their assigned institution
  const id = getInstitutionId(req);
  return id ? { institutionId: id } : {};
};

// ════════════════════════════════════════════════════════════════════
// PERIOD LABEL MAP
// ════════════════════════════════════════════════════════════════════
const PERIOD_LABELS = {
  1: '9:00-10:00', 2: '10:00-11:00', 3: '11:00-12:00', 4: '12:00-1:00',
  5: '1:00-2:00', 6: '2:00-3:00', 7: '3:00-4:00', 8: '4:00-5:00'
};

// ── User Management (Institutional) ──────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { User } = getModels(req);
    const users = await User.find(getInstFilter(req)).select('-password');
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', async (req, res) => {
  try {
    const { User } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { username, password, role, name, email, batch, department } = req.body;
    
    // Check if user already exists
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const user = new User({
      username,
      password,
      role,
      name,
      email,
      batch,
      department,
      institutionId
    });
    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { User } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { username, role, name, email, batch, department } = req.body;
    const updateData = { username, role, name, email, batch, department };
    
    // Check if another user has this username
    if (username) {
      const existing = await User.findOne({ username, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ error: 'Username already exists' });
    }

    if (req.body.password) {
        // Will be hashed by pre-save hook, so we need to fetch, modify, and save
        const user = await User.findOne({ _id: req.params.id, institutionId });
        if (!user) return res.status(404).json({ error: 'User not found' });
        Object.assign(user, updateData);
        user.password = req.body.password;
        await user.save();
        const userResponse = user.toObject();
        delete userResponse.password;
        return res.json(userResponse);
    }

    const user = await User.findOneAndUpdate({ _id: req.params.id, institutionId }, updateData, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { User } = getModels(req);
    const institutionId = getInstitutionId(req);
    const user = await User.findOneAndDelete({ _id: req.params.id, institutionId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

// flattenTimetables – expands elective sub-allocations for faculty/room lookups.
// Each elective group is a separate entry so faculty/room availability is accurate.
// ⚠️  Do NOT use this for period counting – use countValidPeriods() instead.
function flattenTimetables(timetables) {
  const entries = [];
  timetables.forEach(tt => {
    (tt.schedule || []).forEach(daySch => {
      (daySch.periods || []).forEach(p => {
        if (p.type === 'Free' || p.type === 'Lunch') return;
        if (p.isElective && Array.isArray(p.electiveAllocations) && p.electiveAllocations.length > 0) {
          p.electiveAllocations.forEach(alloc => {
            entries.push({
              batch: tt.batch, batchId: tt.batchId,
              day: daySch.day, period: p.period, type: p.type,
              subject: alloc.subject, faculty: alloc.faculty, room: alloc.room,
              subjectType: 'Elective', isElective: true
            });
          });
        } else {
          entries.push({
            batch: tt.batch, batchId: tt.batchId,
            day: daySch.day, period: p.period, type: p.type,
            subject: p.subject, faculty: p.faculty, room: p.room,
            subjectType: p.subjectType || 'Core', isElective: false
          });
        }
      });
    });
  });
  return entries;
}

// countValidPeriods – counts UNIQUE scheduled periods (1 per day+period slot).
// Fixes the 42-vs-35 bug: elective slots with multiple sub-groups counted only once.
function countValidPeriods(timetable) {
  let count = 0;
  (timetable.schedule || []).forEach(daySch => {
    (daySch.periods || []).forEach(p => {
      if (p.type !== 'Free' && p.type !== 'Lunch') count++;
    });
  });
  return count;
}

// getDistinctValues – safe set extraction
function distinct(entries, key) {
  return [...new Set(entries.map(e => e[key]).filter(Boolean))];
}

// ════════════════════════════════════════════════════════════════════
// STANDARD DATA CRUD ROUTES
// ════════════════════════════════════════════════════════════════════

// ── Batches ──────────────────────────────────────────────────────────
router.get('/batches', async (req, res) => {
  try {
    const { Batch } = getModels(req);
    const batches = await Batch.find(getInstFilter(req));

    // Helper: derive year label from semester number
    const semToYear = (sem) => {
      const s = parseInt(sem, 10);
      if (s <= 2) return '1st Year';
      if (s <= 4) return '2nd Year';
      if (s <= 6) return '3rd Year';
      if (s <= 8) return '4th Year';
      return '5th Year+';
    };

    // Enrich each batch with computed fields
    const enriched = batches.map(b => {
      const obj = b.toObject();
      // Assign name if missing
      if (!obj.name) obj.name = obj.batchId || 'Unknown';
      // Compute year: prefer yearLabel, else derive from semester
      obj.computedYear = (obj.yearLabel && obj.yearLabel.trim())
        ? obj.yearLabel.trim()
        : semToYear(obj.semester);
      return obj;
    });

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batches', async (req, res) => {
  try {
    const { Batch } = getModels(req);
    const institutionId = getInstitutionId(req);
    const batch = new Batch({ ...req.body, institutionId });
    await batch.save();
    res.json(batch);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/batches/:id', async (req, res) => {
  try {
    const { Batch } = getModels(req);
    const institutionId = getInstitutionId(req);
    const batch = await Batch.findOneAndUpdate({ _id: req.params.id, institutionId }, req.body, { new: true });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json(batch);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/batches/:id', async (req, res) => {
  try {
    const { Batch } = getModels(req);
    const institutionId = getInstitutionId(req);
    const batch = await Batch.findOneAndDelete({ _id: req.params.id, institutionId });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ message: 'Batch deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batches/bulk-delete', async (req, res) => {
  try {
    const { Batch } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { ids } = req.body;
    await Batch.deleteMany({ _id: { $in: ids }, institutionId });
    res.json({ message: `${ids.length} batches deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Faculty ───────────────────────────────────────────────────────────
router.get('/faculty', async (req, res) => {
  try {
    const { Faculty } = getModels(req);
    const faculty = await Faculty.find(getInstFilter(req));
    res.json(faculty);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/faculty', async (req, res) => {
  try {
    const { Faculty } = getModels(req);
    const institutionId = getInstitutionId(req);
    const faculty = new Faculty({ ...req.body, institutionId });
    await faculty.save();
    res.json(faculty);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/faculty/:id', async (req, res) => {
  try {
    const { Faculty } = getModels(req);
    const institutionId = getInstitutionId(req);
    const faculty = await Faculty.findOneAndUpdate({ _id: req.params.id, institutionId }, req.body, { new: true });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
    res.json(faculty);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/faculty/:id', async (req, res) => {
  try {
    const { Faculty } = getModels(req);
    const institutionId = getInstitutionId(req);
    const faculty = await Faculty.findOneAndDelete({ _id: req.params.id, institutionId });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
    res.json({ message: 'Faculty deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/faculty/bulk-delete', async (req, res) => {
  try {
    const { Faculty } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { ids } = req.body;
    await Faculty.deleteMany({ _id: { $in: ids }, institutionId });
    res.json({ message: `${ids.length} faculty deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Rooms ─────────────────────────────────────────────────────────────
router.get('/rooms', async (req, res) => {
  try {
    const { Room } = getModels(req);
    const rooms = await Room.find(getInstFilter(req));
    res.json(rooms);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/rooms', async (req, res) => {
  try {
    const { Room } = getModels(req);
    const institutionId = getInstitutionId(req);
    const room = new Room({ ...req.body, institutionId });
    await room.save();
    res.json(room);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/rooms/:id', async (req, res) => {
  try {
    const { Room } = getModels(req);
    const institutionId = getInstitutionId(req);
    const room = await Room.findOneAndUpdate({ _id: req.params.id, institutionId }, req.body, { new: true });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/rooms/:id', async (req, res) => {
  try {
    const { Room } = getModels(req);
    const institutionId = getInstitutionId(req);
    const room = await Room.findOneAndDelete({ _id: req.params.id, institutionId });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ message: 'Room deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/rooms/bulk-delete', async (req, res) => {
  try {
    const { Room } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { ids } = req.body;
    await Room.deleteMany({ _id: { $in: ids }, institutionId });
    res.json({ message: `${ids.length} rooms deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Subjects ──────────────────────────────────────────────────────────
router.get('/subjects', async (req, res) => {
  try {
    const { Subject } = getModels(req);
    const subjects = await Subject.find(getInstFilter(req));
    res.json(subjects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/subjects', async (req, res) => {
  try {
    const { Subject } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { name, code } = req.body;
    const subject = new Subject({ name, code, institutionId });
    await subject.save();
    res.json(subject);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/subjects/grouping', async (req, res) => {
  try {
    const { Subject } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { updates } = req.body;
    const operations = updates.map(({ subjectName, slotGroup }) => ({
      updateOne: {
        filter: { name: subjectName, institutionId },
        update: { $set: { slotGroup, name: subjectName, institutionId } },
        upsert: true
      }
    }));
    if (operations.length > 0) await Subject.bulkWrite(operations);
    res.json({ message: 'Subject groupings updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Courses ───────────────────────────────────────────────────────────
router.get('/courses', async (req, res) => {
  try {
    const { Course } = getModels(req);
    const institutionId = getInstitutionId(req);
    const courses = await Course.find({ institutionId });
    res.json(courses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/courses', async (req, res) => {
  try {
    const { Course } = getModels(req);
    const institutionId = getInstitutionId(req);
    const course = new Course({ ...req.body, institutionId });
    await course.save();
    res.json(course);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/courses/:id', async (req, res) => {
  try {
    const { Course } = getModels(req);
    const institutionId = getInstitutionId(req);
    const course = await Course.findOneAndUpdate({ _id: req.params.id, institutionId }, req.body, { new: true });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/courses/:id', async (req, res) => {
  try {
    const { Course } = getModels(req);
    const institutionId = getInstitutionId(req);
    const course = await Course.findOneAndDelete({ _id: req.params.id, institutionId });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json({ message: 'Course deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/courses/bulk-delete', async (req, res) => {
  try {
    const { Course } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { ids } = req.body;
    await Course.deleteMany({ _id: { $in: ids }, institutionId });
    res.json({ message: `${ids.length} courses deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// TIMETABLE ROUTES
// ════════════════════════════════════════════════════════════════════

router.get('/timetables', async (req, res) => {
  try {
    const { Timetable } = getModels(req);
    const items = await Timetable.find(getInstFilter(req)).sort({ createdAt: -1 }).limit(200);
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/timetables/:id', async (req, res) => {
  try {
    const { Timetable } = getModels(req);
    const institutionId = getInstitutionId(req);
    const item = await Timetable.findOne({ _id: req.params.id, institutionId });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/timetables/:id', async (req, res) => {
  try {
    const { Timetable } = getModels(req);
    const institutionId = getInstitutionId(req);
    const result = await Timetable.findOneAndDelete({ _id: req.params.id, institutionId });
    if (!result) return res.status(404).json({ error: 'Timetable not found' });
    res.json({ message: 'Timetable deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});



router.put('/timetables/:id', async (req, res) => {
  try {
    const { Timetable } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { schedule } = req.body;
    const result = await Timetable.findOneAndUpdate(
      { _id: req.params.id, institutionId },
      { schedule },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: 'Timetable not found' });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// TIMETABLE GENERATION
// ════════════════════════════════════════════════════════════════════

router.post('/generate', async (req, res) => {
  try {
    const { Batch, TimetableConfig, Timetable } = getModels(req);
    const institutionId = getInstitutionId(req);
    if (!institutionId) return res.status(400).json({ error: 'Institution ID required' });

    const { batchId, batchIds, batchNames, subjectConfig, batchConfigs, batchRooms, batchLunchConfigs, selectedRooms, weeklySlots, blockedSlots } = req.body;
    const targetBatchIds = batchIds || [batchId];

    if (!targetBatchIds || targetBatchIds.length === 0) {
      return res.status(400).json({ error: 'Batch selection required' });
    }

    const batches = await Batch.find({ _id: { $in: targetBatchIds }, institutionId });
    if (batches.length === 0) return res.status(404).json({ error: 'Batches not found' });

    let config = null;
    if (batches[0].session) {
      config = await TimetableConfig.findOne({ session: batches[0].session, institutionId });
    }

    const rooms = {
      lectureRooms: (selectedRooms?.lectureRooms?.length > 0) ? selectedRooms.lectureRooms : ['Classroom'],
      labRooms: (selectedRooms?.labRooms?.length > 0) ? selectedRooms.labRooms : ['Lab']
    };

    const existingTimetables = await Timetable.find({
      institutionId,
      batchId: { $nin: targetBatchIds }
    });

    const batchNamesMap = {};
    batches.forEach(b => {
      batchNamesMap[b._id.toString()] = b.name || b.batchId || b._id.toString();
    });

    const schedulerOptions = {
      weeklySlots: weeklySlots || null,
      batchRooms: batchRooms || null,
      batchNamesMap: batchNamesMap,
      blockedSlots: blockedSlots || {},
      batchLunchConfigs: batchLunchConfigs || {}
    };

    const scheduler = new Scheduler(config, rooms, existingTimetables, institutionId, schedulerOptions);
    const batchesData = batches.map(b => {
      // Find index in targetBatchIds to get correct batchName from UI if available
      const idx = targetBatchIds.indexOf(b._id.toString());
      const bName = (batchNames && batchNames[idx]) ? batchNames[idx] : (b.name || b.batchId || b._id.toString());
      b.batchId = bName; // temporary set for scheduler

      const finalConf = (batchConfigs && (batchConfigs[b._id.toString()] || batchConfigs[b.batchId])) || subjectConfig;

      return {
        batch: b,
        // If batchConfigs was provided, use the specific one. 
        // Otherwise, or if it's missing, fall back to the main subjectConfig from req.body
        subjectConfig: finalConf
      };
    });

    const results = scheduler.generateMulti(batchesData);

    const savedTimetables = [];
    for (const result of results) {
      await Timetable.deleteMany({
        institutionId,
        $or: [{ batch: result.batchName }, { batchId: result.batchId }]
      });

      const tt = new Timetable({
        institutionId,
        title: `Timetable for ${result.batchName}`,
        batch: result.batchName,
        batchId: result.batchId,
        schedule: result.schedule,
        warnings: result.warnings,
        createdAt: new Date()
      });
      await tt.save();
      savedTimetables.push(tt);
    }

    const allWarnings = results.flatMap(r => r.warnings || []);

    res.json({
      message: `${savedTimetables.length} Timetables generated successfully`,
      timetable: savedTimetables[0],
      timetables: savedTimetables,
      warnings: allWarnings
    });
  } catch (err) {
    console.error("GENERATE ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Stats preview (without generating)
router.post('/stats/preview', async (req, res) => {
  try {
    const { Batch, TimetableConfig } = getModels(req);
    const { batchId, subjectConfig } = req.body;
    let totalSlots = 35;

    if (batchId) {
      const batch = await Batch.findById(batchId);
      if (batch && batch.session) {
        try {
          const config = await TimetableConfig.findOne({ session: batch.session });
          if (config) {
            const pPerDay = config.periodsPerDay || 8;
            const days = (config.workingDays && config.workingDays.length > 0) ? config.workingDays.length : 5;
            const lunchEnabled = config.lunchBreak && config.lunchBreak.enabled;
            totalSlots = (pPerDay * days) - (lunchEnabled ? days : 0);
          }
        } catch (e) { /* fallback */ }
      }
    }

    let allocatedSlots = 0;
    const groupedElectiveSubjects = {};

    Object.entries(subjectConfig).forEach(([subject, conf]) => {
      const lectures = parseInt(conf.lectureHours || 0);
      const labs = parseInt(conf.labHours || 0);
      const slotGroup = String(conf.slotGroup || '').trim().toUpperCase();
      const isGroupedElective = String(conf.subjectType || '').toLowerCase() === 'elective' &&
        (slotGroup === 'A' || slotGroup === 'B');

      if (isGroupedElective) {
        if (!groupedElectiveSubjects[slotGroup]) groupedElectiveSubjects[slotGroup] = [];
        groupedElectiveSubjects[slotGroup].push(subject);
        return;
      }
      allocatedSlots += lectures + labs;
    });

    Object.entries(groupedElectiveSubjects).forEach(([, slotSubjects]) => {
      if (!slotSubjects || slotSubjects.length === 0) return;
      const allLecHours = slotSubjects.map(s => parseInt(subjectConfig[s]?.lectureHours || 0));
      const minLecHours = Math.min(...allLecHours);
      allocatedSlots += minLecHours;
      slotSubjects.forEach(s => {
        const extra = parseInt(subjectConfig[s]?.lectureHours || 0) - minLecHours;
        if (extra > 0) allocatedSlots += extra;
      });
      const labSubjects = slotSubjects.filter(s => parseInt(subjectConfig[s]?.labHours || 0) > 0);
      if (labSubjects.length > 0) {
        const allLabHours = labSubjects.map(s => parseInt(subjectConfig[s]?.labHours || 0));
        const minLabHours = Math.min(...allLabHours);
        const labDuration = (minLabHours % 3 === 0) ? 3 : 2;
        allocatedSlots += Math.floor(minLabHours / labDuration) * labDuration;
        labSubjects.forEach(s => {
          const extraLab = parseInt(subjectConfig[s]?.labHours || 0) - minLabHours;
          if (extraLab > 0) {
            const d = (extraLab % 3 === 0) ? 3 : 2;
            allocatedSlots += Math.floor(extraLab / d) * d;
          }
        });
      }
    });

    res.json({
      totalSlots, allocatedSlots,
      freeSlots: Math.max(0, totalSlots - allocatedSlots),
      remainingHours: Math.max(0, totalSlots - allocatedSlots)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// REPORTING & ANALYTICS – Comprehensive Implementation
// ════════════════════════════════════════════════════════════════════

// ── 1. Faculty Wise Report ───────────────────────────────────────────
router.get('/reports/faculty', async (req, res) => {
  try {
    const { Timetable, Faculty } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { facultyNames } = req.query;
    const names = Array.isArray(facultyNames)
      ? facultyNames
      : (facultyNames ? facultyNames.split(',').map(s => s.trim()).filter(Boolean) : []);

    const timetables = await Timetable.find({ institutionId });
    const allFaculty = await Faculty.find({ institutionId });
    const entries = flattenTimetables(timetables);

    const targetNames = names.length > 0 ? names : allFaculty.map(f => f.name);

    const report = {};
    targetNames.forEach(name => {
      const myEntries = entries.filter(e => e.faculty === name);
      const schedule = myEntries.map(e => ({
        day: e.day, period: e.period, timeLabel: PERIOD_LABELS[e.period] || `P${e.period}`,
        subject: e.subject, room: e.room, batch: e.batch, type: e.type
      }));

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const weeklyGrid = {};
      days.forEach(d => { weeklyGrid[d] = {}; });
      schedule.forEach(s => { if (weeklyGrid[s.day]) weeklyGrid[s.day][s.period] = s; });

      report[name] = {
        schedule, weeklyGrid,
        totalHours: schedule.length,
        freeSlots: Math.max(0, (5 * 7) - schedule.length)
      };
    });

    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 2. Room Wise Report ──────────────────────────────────────────────
router.get('/reports/room', async (req, res) => {
  try {
    const { Timetable, Room } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { roomNames } = req.query;
    const names = Array.isArray(roomNames)
      ? roomNames
      : (roomNames ? roomNames.split(',').map(s => s.trim()).filter(Boolean) : []);

    const timetables = await Timetable.find({ institutionId });
    const allRooms = await Room.find({ institutionId });
    const entries = flattenTimetables(timetables);

    const targetNames = names.length > 0 ? names : allRooms.map(r => r.name);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const allPeriods = [1, 2, 3, 4, 5, 6, 7, 8];

    const report = {};
    targetNames.forEach(name => {
      const myEntries = entries.filter(e => e.room === name);
      const occupied = myEntries.map(e => ({
        day: e.day, period: e.period, timeLabel: PERIOD_LABELS[e.period] || `P${e.period}`,
        subject: e.subject, faculty: e.faculty, batch: e.batch, type: e.type
      }));

      const grid = {};
      days.forEach(d => {
        grid[d] = {};
        allPeriods.forEach(p => { grid[d][p] = { status: 'Free', data: null }; });
      });
      occupied.forEach(o => {
        if (grid[o.day]) grid[o.day][o.period] = { status: 'Occupied', data: o };
      });

      const roomInfo = allRooms.find(r => r.name === name);
      const totalSlots = days.length * allPeriods.length;          // 5 × 8 = 40
      report[name] = {
        type: roomInfo?.type || 'Unknown',
        capacity: roomInfo?.capacity || '-',
        occupied, grid,
        usedHours: occupied.length,
        totalHours: totalSlots,
        utilizationPct: ((occupied.length / totalSlots) * 100).toFixed(1)
      };
    });

    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 3. Course Wise Report ────────────────────────────────────────────
router.get('/reports/course', async (req, res) => {
  try {
    const { Timetable } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { courseName } = req.query;

    const timetables = await Timetable.find({ institutionId });
    const entries = flattenTimetables(timetables);

    if (!courseName) {
      const distinctCourses = [...new Set(entries.map(e => e.subject).filter(Boolean))].sort();
      return res.json({ courses: distinctCourses });
    }

    const myEntries = entries.filter(e =>
      e.subject && e.subject.toLowerCase().includes(courseName.toLowerCase())
    );

    const schedule = myEntries.map(e => ({
      day: e.day, period: e.period, timeLabel: PERIOD_LABELS[e.period] || `P${e.period}`,
      faculty: e.faculty, room: e.room, batch: e.batch, type: e.type
    }));

    res.json({
      courseName, schedule,
      faculties: [...new Set(myEntries.map(e => e.faculty).filter(Boolean))],
      rooms: [...new Set(myEntries.map(e => e.room).filter(Boolean))],
      batches: [...new Set(myEntries.map(e => e.batch).filter(Boolean))],
      totalEntries: schedule.length
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 4. Batch Wise Report ─────────────────────────────────────────────
router.get('/reports/batch', async (req, res) => {
  try {
    const { Timetable } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { batchId } = req.query;
    const timetables = await Timetable.find({ institutionId });

    if (!batchId) {
      const summaries = timetables.map(tt => {
        const entries = flattenTimetables([tt]);
        return {
          id: tt._id, batchId: tt.batchId, batchName: tt.batch,
          totalPeriods: countValidPeriods(tt),           // ← fixed: deduped count
          subjects: distinct(entries, 'subject').length,
          faculty: distinct(entries, 'faculty').length,
        };
      });
      return res.json(summaries);
    }


    const tt = timetables.find(t =>
      t.batchId === batchId || t._id.toString() === batchId || t.batch === batchId
    );
    if (!tt) return res.status(404).json({ error: 'Timetable not found for batch' });

    const entries = flattenTimetables([tt]);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const allPeriods = [1, 2, 3, 4, 5, 6, 7, 8];

    const grid = {};
    days.forEach(d => { grid[d] = {}; allPeriods.forEach(p => { grid[d][p] = null; }); });
    (tt.schedule || []).forEach(daySch => {
      (daySch.periods || []).forEach(p => {
        if (grid[daySch.day]) grid[daySch.day][p.period] = p;
      });
    });

    // Subject distribution – count each PERIOD once even for elective slots
    const subjectDist = {};
    (tt.schedule || []).forEach(daySch => {
      (daySch.periods || []).forEach(p => {
        if (p.type === 'Free' || p.type === 'Lunch') return;
        if (p.isElective && Array.isArray(p.electiveAllocations) && p.electiveAllocations.length > 0) {
          // For grouped electives, list each subject individually
          p.electiveAllocations.forEach(alloc => {
            if (alloc.subject) subjectDist[alloc.subject] = (subjectDist[alloc.subject] || 0) + 1;
          });
        } else if (p.subject) {
          subjectDist[p.subject] = (subjectDist[p.subject] || 0) + 1;
        }
      });
    });

    // totalPeriods = unique (day, period) slots that are scheduled (not Free/Lunch)
    const totalPeriods = countValidPeriods(tt);

    res.json({
      batchName: tt.batch, batchId: tt.batchId,
      schedule: tt.schedule, grid, entries,
      summary: {
        subjects: distinct(entries, 'subject'),
        faculty: distinct(entries, 'faculty'),
        rooms: distinct(entries, 'room')
      },
      subjectDistribution: subjectDist,
      totalPeriods
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Legacy batch wise report by param (keep for compatibility)
router.get('/reports/batch/:batchId', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const tt = await Timetable.findOne({
      institutionId,
      $or: [{ batchId: req.params.batchId }, { batch: req.params.batchId }]
    });
    if (!tt) return res.status(404).json({ error: 'Timetable not found for batch' });
    res.json(tt);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 5. Week & Time Slot Analysis ─────────────────────────────────────
router.get('/analysis/slots', async (req, res) => {
  try {
    const { Timetable, Faculty, Room } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { day, periods } = req.query;
    const periodNums = periods ? periods.split(',').map(Number).filter(n => !isNaN(n)) : [1, 2, 3, 4, 5, 6, 7, 8];
    const targetDay = day || 'Monday';

    const timetables = await Timetable.find({ institutionId });
    const allFaculty = await Faculty.find({ institutionId });
    const allRooms = await Room.find({ institutionId });
    const entries = flattenTimetables(timetables);

    const result = periodNums.map(pNum => {
      const slotEntries = entries.filter(e => e.day === targetDay && e.period === pNum);
      const busyFaculty = new Set(slotEntries.map(e => e.faculty).filter(Boolean));
      const busyRooms = new Set(slotEntries.map(e => e.room).filter(Boolean));

      return {
        period: pNum,
        timeLabel: PERIOD_LABELS[pNum] || `Period ${pNum}`,
        freeFaculty: allFaculty.filter(f => !busyFaculty.has(f.name)).map(f => ({ name: f.name, department: f.department })),
        busyFaculty: slotEntries.map(e => ({ name: e.faculty, subject: e.subject, room: e.room, batch: e.batch })).filter(e => e.name),
        freeRooms: allRooms.filter(r => !busyRooms.has(r.name)).map(r => ({ name: r.name, type: r.type })),
        busyRooms: slotEntries.map(e => ({ name: e.room, subject: e.subject, faculty: e.faculty, batch: e.batch })).filter(e => e.name),
        occupancy: slotEntries
      };
    });

    res.json({ day: targetDay, periods: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 6. Room Utilization Analytics ────────────────────────────────────
router.get('/analytics/room-utilization', async (req, res) => {
  try {
    const { Timetable, Room, TimetableConfig } = getModels(req);
    const institutionId = getInstitutionId(req);
    const timetables = await Timetable.find({ institutionId });
    const allRooms = await Room.find({ institutionId });
    const config = await TimetableConfig.findOne({ institutionId });

    const daysCount = config?.workingDays?.length || 5;
    const periodsCount = config?.periodsPerDay || 8;
    const lunchDed = (config?.lunchBreak?.enabled) ? daysCount : 0;
    const totalPossible = (periodsCount * daysCount) - lunchDed;

    const entries = flattenTimetables(timetables);

    const utilization = {};
    allRooms.forEach(r => {
      utilization[r.name] = { usedHours: 0, totalHours: totalPossible, type: r.type, capacity: r.capacity };
    });

    entries.forEach(e => {
      if (e.room && utilization[e.room]) utilization[e.room].usedHours++;
    });

    const report = Object.entries(utilization)
      .map(([name, s]) => ({
        room: name, type: s.type, capacity: s.capacity,
        usedHours: s.usedHours, totalHours: s.totalHours,
        freeHours: s.totalHours - s.usedHours,
        percentage: s.totalHours > 0 ? ((s.usedHours / s.totalHours) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 7. Course Load Distribution (L-T-P) ──────────────────────────────
router.get('/analytics/course-load', async (req, res) => {
  try {
    const { Course } = getModels(req);
    const institutionId = getInstitutionId(req);
    const courses = await Course.find({ institutionId });

    const grouped = {};
    courses.forEach(c => {
      const key = c.subject || c.courseCode || 'Unknown';
      if (!grouped[key]) {
        grouped[key] = {
          courseName: c.subject, courseCode: c.courseCode,
          department: c.department, program: c.program,
          L: 0, T: 0, P: 0, credits: c.credits || 0, faculty: new Set()
        };
      }
      if (c.facultyName) grouped[key].faculty.add(c.facultyName);
      grouped[key].L = Math.max(grouped[key].L, c.courseL || 0);
      grouped[key].T = Math.max(grouped[key].T, c.courseT || 0);
      grouped[key].P = Math.max(grouped[key].P, c.courseP || 0);
    });

    const report = Object.values(grouped).map(g => ({
      courseName: g.courseName, courseCode: g.courseCode,
      department: g.department, program: g.program,
      noOfFaculty: g.faculty.size,
      facultyNames: Array.from(g.faculty),
      L: g.L, T: g.T, P: g.P,
      total: g.L + g.T + g.P,
      credits: g.credits
    })).sort((a, b) => b.total - a.total);

    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 8. Distinct courses list (for dropdowns) ─────────────────────────
router.get('/reports/courses-list', async (req, res) => {
  try {
    const { Course } = getModels(req);
    const institutionId = getInstitutionId(req);
    const courses = await Course.find({ institutionId }, { subject: 1, courseCode: 1, department: 1 });
    const distinct = [...new Map(courses.map(c => [c.subject, c])).values()]
      .map(c => ({ name: c.subject, code: c.courseCode, dept: c.department }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(distinct);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 9. Faculty Availability Heat-Map ─────────────────────────────────
router.get('/faculty-info/availability', async (req, res) => {
  try {
    const { Faculty, Room, Timetable } = getModels(req);
    const institutionId = getInstitutionId(req);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periods = [1, 2, 3, 4, 5, 6, 7, 8];

    const allFaculty = await Faculty.find({ institutionId });
    const allRooms = await Room.find({ institutionId });
    const timetables = await Timetable.find({ institutionId });
    const entries = flattenTimetables(timetables);

    const availability = days.map(day => {
      const periodData = periods.map(period => {
        const slotEntries = entries.filter(e => e.day === day && e.period === period);
        const occupiedFaculty = new Set(slotEntries.map(e => e.faculty).filter(Boolean));
        const occupiedRooms = new Set(slotEntries.map(e => e.room).filter(Boolean));
        const availableFacultyList = allFaculty.filter(f => !occupiedFaculty.has(f.name));
        const availableRoomsList = allRooms.filter(r => !occupiedRooms.has(r.name));

        return {
          period,
          total: allFaculty.length,
          availableCount: availableFacultyList.length,
          availableFaculty: availableFacultyList,
          busyFacultyNames: Array.from(occupiedFaculty),
          totalRooms: allRooms.length,
          availableRoomCount: availableRoomsList.length,
          availableRooms: availableRoomsList
        };
      });
      return { day, periods: periodData };
    });

    res.json(availability);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 10. Conflict Checker ──────────────────────────────────────────────
router.get('/timetables/conflicts/:day/:period', async (req, res) => {
  try {
    const { Timetable } = getModels(req);
    const institutionId = getInstitutionId(req);
    const { day, period } = req.params;
    const periodNum = parseInt(period);
    const timetables = await Timetable.find({ institutionId });
    const entries = flattenTimetables(timetables);

    const slotEntries = entries.filter(e => e.day === day && e.period === periodNum);
    const occupiedRooms = [...new Set(slotEntries.map(e => e.room).filter(Boolean))];
    const occupiedFaculty = [...new Set(slotEntries.map(e => e.faculty).filter(Boolean))];

    // Build day-level faculty busy map for consecutive check
    const dayEntries = entries.filter(e => e.day === day);
    const facultyBusyMap = {};
    dayEntries.forEach(e => {
      if (e.faculty) {
        if (!facultyBusyMap[e.faculty]) facultyBusyMap[e.faculty] = [];
        facultyBusyMap[e.faculty].push(e.period);
      }
    });

    res.json({ occupiedRooms, occupiedFaculty, facultyBusyMap });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
