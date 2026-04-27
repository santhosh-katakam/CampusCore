const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const router = express.Router();

// Models
// Models (Registries)
const FacultyRegistry = require('../models/Faculty');
const RoomRegistry = require('../models/Room');
const BatchRegistry = require('../models/Batch');
const CourseRegistry = require('../models/Course');
const SubjectRegistry = require('../models/Subject');
const TimetableConfigRegistry = require('../models/TimetableConfig');
const mongoose = require('mongoose');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper: Resolve the correct model based on tenancy
const getModels = (req) => {
    return req.tenantModels || {
        Faculty: FacultyRegistry.getFacultyModel(mongoose.connection),
        Room: RoomRegistry.getRoomModel(mongoose.connection),
        Batch: BatchRegistry.getBatchModel(mongoose.connection),
        Course: CourseRegistry.getCourseModel(mongoose.connection),
        Subject: SubjectRegistry.getSubjectModel(mongoose.connection),
        TimetableConfig: TimetableConfigRegistry.getTimetableConfigModel(mongoose.connection)
    };
};

// Middleware to extract institutionId (consistent with api.js)
const getInstitutionId = (req) => {
    if (req.user && req.user.institutionId) return req.user.institutionId;
    const id = req.headers['x-institution-id'];
    if (!id || id === 'null' || id === 'undefined' || id === '') {
        return process.env.DEFAULT_INSTITUTION_ID;
    }
    return id;
};


// Helper function to parse Excel file
function parseExcelFile(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets = {};

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        sheets[sheetName] = XLSX.utils.sheet_to_json(worksheet);
    });

    return sheets;
}

// Upload and process Excel file
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { Faculty, Room, Batch, Course, Subject } = getModels(req);
        const institutionId = getInstitutionId(req);
        if (!institutionId) return res.status(400).json({ error: 'Institution ID required for upload' });

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const sheets = parseExcelFile(req.file.buffer);
        const results = {
            faculty: { added: 0, updated: 0, errors: [] },
            rooms: { added: 0, updated: 0, errors: [] },
            batches: { added: 0, updated: 0, errors: [] },
            courses: { added: 0, updated: 0, errors: [] },
            subjects: { added: 0, updated: 0, errors: [] }
        };

        const isHodOrFaculty = req.user && (req.user.role === 'HOD' || req.user.role === 'FACULTY');

        // Helper to check if a sheet looks like course data
        const isCourseSheet = (name) => {
            const data = sheets[name];
            if (!data || data.length === 0) return false;
            const cols = Object.keys(data[0]).map(c => c.toLowerCase());
            return cols.some(c => c.includes('course code')) && cols.some(c => c.includes('subject'));
        };

        // Process Faculty Sheet - Try multiple possible sheet names
        const facultySheetNames = Object.keys(sheets).filter(name =>
            (name.toLowerCase().includes('faculty') ||
            name.toLowerCase().includes('employee') ||
            name === 'Sheet1') && !isCourseSheet(name)
        );


        // If no specific faculty sheet found, try the first sheet if it has faculty-like columns
        let facultySheet = null;
        if (facultySheetNames.length > 0) {
            facultySheet = sheets[facultySheetNames[0]];
        } else if (Object.keys(sheets).length > 0) {
            // Check if first sheet has faculty columns
            const firstSheet = sheets[Object.keys(sheets)[0]];
            if (firstSheet.length > 0) {
                const firstRow = firstSheet[0];
                const columns = Object.keys(firstRow);
                
                // Explicitly skip if it looks like course data
                const isCourse = columns.some(c => c.toLowerCase().includes('course code')) && 
                                columns.some(c => c.toLowerCase().includes('subject'));
                                
                if (!isCourse) {
                    const hasEmpId = columns.some(key =>
                        key.toLowerCase().includes('emp') || key.toLowerCase().includes('faculty id')
                    );
                    if (hasEmpId) {
                        facultySheet = firstSheet;
                    }
                }
            }
        }

        if (facultySheet && facultySheet.length > 0) {

            for (const row of facultySheet) {
                try {
                    // Try multiple column name variations
                    const facultyId = String(
                        row['Faculty ID'] ||
                        row['Emp ID'] ||
                        row['Employee ID'] ||
                        row['S No.'] ||
                        row['S No'] ||
                        ''
                    ).trim();

                    const name = String(
                        row['Faculty Name'] ||
                        row['Employee Name'] ||
                        row['Name'] ||
                        ''
                    ).trim();

                    const department = String(
                        row['Faculty Department'] ||
                        row['Department'] ||
                        row['Dept'] ||
                        ''
                    ).trim();

                    const email = String(
                        row['Faculty Email'] ||
                        row['Email'] ||
                        row['E-mail'] ||
                        ''
                    ).trim();


                    if (!facultyId || !name || !department || !email) {
                        results.faculty.errors.push(`Missing required fields - ID: ${facultyId}, Name: ${name}, Dept: ${department}, Email: ${email}`);
                        continue;
                    }

                    const existing = await Faculty.findOne({ facultyId, institutionId });
                    if (existing) {
                        await Faculty.updateOne(
                            { facultyId, institutionId },
                            { name, department, email }
                        );
                        results.faculty.updated++;
                    } else {
                        await Faculty.create({ facultyId, name, department, email, institutionId });
                        results.faculty.added++;
                    }
                } catch (err) {
                    console.error('Error processing faculty row:', err);
                    results.faculty.errors.push(err.message);
                }
            }
        } else {
        }

        // Process Rooms Sheet - Try multiple possible sheet names
        const roomSheetNames = Object.keys(sheets).filter(name =>
            (name.toLowerCase().includes('room') ||
            name === 'Sheet1') && !isCourseSheet(name)
        );


        // If no specific room sheet found, try the first sheet if it has room-like columns
        let roomSheet = null;
        if (roomSheetNames.length > 0) {
            roomSheet = sheets[roomSheetNames[0]];
        } else if (Object.keys(sheets).length > 0) {
            // Check if first sheet has room columns
            const firstSheet = sheets[Object.keys(sheets)[0]];
            if (firstSheet.length > 0) {
                const firstRow = firstSheet[0];
                const columns = Object.keys(firstRow);
                
                // Explicitly skip if it looks like course data
                const isCourse = columns.some(c => c.toLowerCase().includes('course code')) && 
                                columns.some(c => c.toLowerCase().includes('subject'));
                
                if (!isCourse) {
                    const hasRoomName = columns.some(key =>
                        key.toLowerCase().includes('room')
                    );
                    if (hasRoomName) {
                        roomSheet = firstSheet;
                    }
                }
            }
        }

        if (roomSheet && roomSheet.length > 0) {

            for (let i = 0; i < roomSheet.length; i++) {
                const row = roomSheet[i];
                try {
                    // Try multiple column name variations
                    // Use row number as ID if no ID column exists
                    const roomId = String(
                        row['Room ID'] ||
                        row['S No.'] ||
                        row['S No'] ||
                        row['Room Name/Number'] ||
                        row['Room Name'] ||
                        (i + 1) // Use row number as fallback
                    ).trim();

                    const name = String(
                        row['Room Name/Number'] ||
                        row['Room Name'] ||
                        row['Name'] ||
                        ''
                    ).trim();

                    const type = String(
                        row['Room Type'] ||
                        row['Type'] ||
                        ''
                    ).trim();

                    const capacity = parseInt(
                        row['Capacity'] ||
                        row['Cap'] ||
                        30
                    );

                    const session = String(
                        row['Session'] ||
                        row['Session year'] ||
                        row['Session Year'] ||
                        ''
                    ).trim();


                    if (!name || !type || !session) {
                        results.rooms.errors.push(`Missing required fields - Name: ${name}, Type: ${type}, Session: ${session}`);
                        continue;
                    }

                    // Use room name as unique identifier if roomId is just a number
                    const uniqueId = name || roomId;

                    const existing = await Room.findOne({ roomId: uniqueId, institutionId });
                    if (existing) {
                        await Room.updateOne(
                            { roomId: uniqueId, institutionId },
                            { name, type, capacity, session }
                        );
                        results.rooms.updated++;
                    } else {
                        await Room.create({ roomId: uniqueId, name, type, capacity, session, institutionId });
                        results.rooms.added++;
                    }
                } catch (err) {
                    console.error('Error processing room row:', err);
                    results.rooms.errors.push(err.message);
                }
            }
        } else {
        }

        // Process Batches Sheet - Try multiple possible sheet names
        const batchSheetNames = Object.keys(sheets).filter(name =>
            (name.toLowerCase().includes('batch') ||
            name === 'Sheet1') && !isCourseSheet(name)
        );


        // If no specific batch sheet found, try the first sheet if it has batch-like columns
        let batchSheet = null;
        if (batchSheetNames.length > 0) {
            batchSheet = sheets[batchSheetNames[0]];
        } else if (Object.keys(sheets).length > 0) {
            // Check if first sheet has batch columns
            const firstSheet = sheets[Object.keys(sheets)[0]];
            if (firstSheet.length > 0) {
                const firstRow = firstSheet[0];
                const columns = Object.keys(firstRow);
                
                // Explicitly skip if it looks like course data
                const isCourse = columns.some(c => c.toLowerCase().includes('course code')) && 
                                columns.some(c => c.toLowerCase().includes('subject'));
                
                if (!isCourse) {
                    const hasBatch = columns.some(key =>
                        key.toLowerCase().includes('batch') || key.toLowerCase().includes('semester')
                    );
                    if (hasBatch) {
                        batchSheet = firstSheet;
                    }
                }
            }
        }

        if (batchSheet && batchSheet.length > 0) {

            for (const row of batchSheet) {
                try {
                    // Try multiple column name variations
                    const batchId = String(
                        row['Batch ID'] ||
                        row['Batch'] ||
                        row['Batch Code'] ||
                        ''
                    ).trim();

                    // Helper to parse semester (Handle Roman Numerals)
                    let semester = 0;
                    const semInput = String(row['Semester'] || row['Sem'] || '').trim().toUpperCase();
                    if (semInput === 'I' || semInput === '1') semester = 1;
                    else if (semInput === 'II' || semInput === '2') semester = 2;
                    else if (semInput === 'III' || semInput === '3') semester = 3;
                    else if (semInput === 'IV' || semInput === '4') semester = 4;
                    else if (semInput === 'V' || semInput === '5') semester = 5;
                    else if (semInput === 'VI' || semInput === '6') semester = 6;
                    else if (semInput === 'VII' || semInput === '7') semester = 7;
                    else if (semInput === 'VIII' || semInput === '8') semester = 8;
                    else semester = parseInt(semInput) || 0;

                    const degree = String(
                        row['Degree'] ||
                        row['Program'] ||
                        ''
                    ).trim();

                    const yearLabel = String(
                        row['Year'] ||
                        row['Academic Year'] ||
                        row['year'] ||
                        ''
                    ).trim();

                    const department = String(
                        row['Department'] ||
                        row['School/Department'] ||
                        row['Dept'] ||
                        ''
                    ).trim();

                    const session = String(
                        row['Session'] ||
                        row['Session Year'] ||
                        row['Academic Session'] ||
                        ''
                    ).trim();


                    if (!batchId || !semester) {
                        results.batches.errors.push(`Row ${results.batches.added + results.batches.updated + results.batches.errors.length + 1}: Missing critical fields (Batch ID or Semester).`);
                        continue;
                    }

                    // Convert year to number just in case
                    let yearNumber = 1;
                    if (yearLabel.toLowerCase().includes('second') || yearLabel.includes('2')) yearNumber = 2;
                    else if (yearLabel.toLowerCase().includes('third') || yearLabel.includes('3')) yearNumber = 3;
                    else if (yearLabel.toLowerCase().includes('fourth') || yearLabel.includes('4')) yearNumber = 4;

                    const batchData = {
                        batchId,
                        semester,
                        degree,
                        yearLabel,
                        department,
                        session,
                        institutionId
                    };

                    const existing = await Batch.findOne({ batchId, institutionId });
                    if (existing) {
                        await Batch.updateOne({ _id: existing._id }, batchData);
                        results.batches.updated++;
                    } else {
                        await Batch.create(batchData);
                        results.batches.added++;
                    }
                } catch (err) {
                    console.error('Error processing batch row:', err);
                    results.batches.errors.push(`Row ${results.batches.added + results.batches.updated + results.batches.errors.length + 1}: ${err.message}`);
                }
            }
        } else {
        }

        // Process Course Data Sheets (First Year, Third Year, etc.)
        let courseSheets = Object.keys(sheets).filter(name =>
            name.toLowerCase().includes('year') ||
            name.toLowerCase().includes('data') ||
            name.toLowerCase().includes('course')
        );

        // If no course sheets found by name, check if any sheet has course-like columns
        if (courseSheets.length === 0) {
            for (const sheetName of Object.keys(sheets)) {
                const sheetData = sheets[sheetName];
                if (sheetData.length > 0) {
                    const firstRow = sheetData[0];
                    const columns = Object.keys(firstRow);

                    // Check if it has course-like columns
                    const hasCourseCode = columns.some(col =>
                        col.toLowerCase().includes('course code') ||
                        col.toLowerCase().includes('course_code')
                    );
                    const hasSubject = columns.some(col =>
                        col.toLowerCase().includes('subject')
                    );
                    const hasBatch = columns.some(col =>
                        col.toLowerCase().includes('batch')
                    );

                    // If it has course-like columns and hasn't been processed as faculty/room/batch
                    if (hasCourseCode && hasSubject && hasBatch) {
                        courseSheets.push(sheetName);
                    }
                }
            }
        }


        for (const sheetName of courseSheets) {
            const courseData = sheets[sheetName];
            if (courseData.length > 0) {
            }

            for (const row of courseData) {
                try {
                    const facultyId = String(row['Faculty ID'] || row['Emp ID'] || row['Fmp ID'] || '').trim();
                    const facultyName = String(row['Faculty Name'] || row['Faculty'] || row['Employee Name'] || '').trim();
                    const courseCode = String(row['Course Code'] || row['Course code'] || '').trim();
                    const subject = String(row['Subject'] || row['Subject Name'] || '').trim();
                    const type = String(row['Type'] || row['Type(Core/Elective)'] || '').trim();
                    const batch = String(row['Batch'] || row['Batch ID'] || '').trim();
                    const courseL = parseInt(row['Course L'] || row['L'] || 0);
                    const courseT = parseInt(row['Course T'] || row['T'] || 0);
                    const courseP = parseInt(row['Course P'] || row['P'] || 0);
                    const credits = parseInt(row['Credits'] || row['credits'] || 0);
                    const year = String(row['Year'] || row['Year(first year)'] || row['Year(third year)'] || '').trim();

                    // Helper to parse semester (Handle Roman Numerals)
                    let semester = 0;
                    const semInput = String(row['Semester'] || row['semester'] || '').trim().toUpperCase();
                    if (semInput === 'I' || semInput === '1') semester = 1;
                    else if (semInput === 'II' || semInput === '2') semester = 2;
                    else if (semInput === 'III' || semInput === '3') semester = 3;
                    else if (semInput === 'IV' || semInput === '4') semester = 4;
                    else if (semInput === 'V' || semInput === '5') semester = 5;
                    else if (semInput === 'VI' || semInput === '6') semester = 6;
                    else if (semInput === 'VII' || semInput === '7') semester = 7;
                    else if (semInput === 'VIII' || semInput === '8') semester = 8;
                    else semester = parseInt(semInput) || 0;

                    const program = String(row['Program'] || row['Program(B.tech)'] || '').trim();
                    const department = String(row['Department'] || row['Department(CSE/ECE/etc...)'] || '').trim();
                    const facultyL = parseInt(row['Faculty L'] || row['Fauclty L'] || 0);
                    const facultyT = parseInt(row['Faculty T'] || 0);
                    const facultyP = parseInt(row['Faculty P'] || 0);
                    const totalLoad = parseInt(row['Total Load']) || (facultyL + facultyT + facultyP);
                    const session = String(row['Session'] || '').trim();


                    if (!facultyId || !courseCode || !subject || !batch) {
                        results.courses.errors.push(`Missing required fields - Faculty: ${facultyId}, Course: ${courseCode}, Subject: ${subject}, Batch: ${batch}`);
                        continue;
                    }

                    // Create or update Subject (Only for non-HOD/Faculty)
                    if (subject && courseCode && !isHodOrFaculty) {
                        try {
                            const existingSubject = await Subject.findOne({ code: courseCode, institutionId });
                            if (existingSubject) {
                                if (existingSubject.name !== subject) {
                                    await Subject.updateOne(
                                        { code: courseCode, institutionId },
                                        { name: subject }
                                    );
                                    results.subjects.updated++;
                                }
                            } else {
                                await Subject.create({ name: subject, code: courseCode, institutionId });
                                results.subjects.added++;
                            }
                        } catch (subErr) {
                            console.error('Error processing subject:', subErr);
                            results.subjects.errors.push(`Subject ${subject}: ${subErr.message}`);
                        }
                    }

                    // Create or update Course
                    const existing = await Course.findOne({
                        facultyId,
                        courseCode,
                        batch,
                        semester,
                        session,
                        institutionId
                    });

                    const courseDoc = {
                        facultyId,
                        facultyName,
                        courseCode,
                        subject,
                        type,
                        batch,
                        courseL,
                        courseT,
                        courseP,
                        credits,
                        year,
                        semester,
                        program,
                        department,
                        facultyL,
                        facultyT,
                        facultyP,
                        totalLoad,
                        session,
                        institutionId
                    };

                    if (existing) {
                        await Course.updateOne(
                            { _id: existing._id },
                            courseDoc
                        );
                        results.courses.updated++;
                    } else {
                        await Course.create(courseDoc);
                        results.courses.added++;
                    }
                } catch (err) {
                    console.error('Error processing course row:', err);
                    results.courses.errors.push(err.message);
                }
            }
        }

        res.json({
            success: true,
            message: 'Excel file processed successfully',
            results
        });

    } catch (error) {
        console.error('Error processing Excel file:', error);
        res.status(500).json({
            error: 'Failed to process Excel file',
            details: error.message
        });
    }
});

// Get upload statistics
router.get('/stats', async (req, res) => {
    try {
        const { Faculty, Room, Batch, Course, Subject } = getModels(req);
        const institutionId = getInstitutionId(req);
        const filter = institutionId ? { institutionId } : {};

        const stats = {
            faculty: await Faculty.countDocuments(filter),
            rooms: await Room.countDocuments(filter),
            batches: await Batch.countDocuments(filter),
            courses: await Course.countDocuments(filter),
            subjects: await Subject.countDocuments(filter)
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper to generate and send a single-sheet Excel workbook
const sendSingleSheetTemplate = (res, data, sheetName, filename) => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
};

// 1. Faculty Template
router.get('/template/faculty', (req, res) => {
    const data = [{ "Faculty ID": "FAC001", "Faculty Name": "Dr. John Doe", "Faculty Department": "Computer Science", "Faculty Email": "john.doe@university.edu" }];
    sendSingleSheetTemplate(res, data, "Faculty", "faculty_template.xlsx");
});

// 2. Rooms Template
router.get('/template/rooms', (req, res) => {
    const data = [{ "Room ID": "R101", "Room Name/Number": "Room 101", "Room Type": "Theory", "Capacity": 60, "Session": "2024-25" }];
    sendSingleSheetTemplate(res, data, "Rooms", "rooms_template.xlsx");
});

// 3. Batches Template
router.get('/template/batches', (req, res) => {
    const data = [{ "Batch ID": "CSE-A", "Semester": "V", "Degree": "B.Tech", "Year": "Third Year", "Department": "CSE", "Session": "2024-25" }];
    sendSingleSheetTemplate(res, data, "Batches", "batches_template.xlsx");
});

// 4. Course Data Template
router.get('/template/courses', (req, res) => {
    const data = [{ 
        "Faculty ID": "FAC001", "Faculty Name": "Dr. John Doe", "Course Code": "CS301", "Subject": "Data Structures", 
        "Type": "Core", "Batch": "CSE-A", "Course L": 3, "Course T": 1, "Course P": 0, "Credits": 4, 
                "Semester": "V", "Program": "B.Tech", "Department": "CSE", "Session": "2024-25" 
    }];
    sendSingleSheetTemplate(res, data, "Course Data", "courses_template.xlsx");
});

// Download All-in-One Excel Template
router.get('/template', (req, res) => {
    try {
        const workbook = XLSX.utils.book_new();

        // Faculty
        const facultyData = [{ "Faculty ID": "FAC001", "Faculty Name": "Dr. John Doe", "Faculty Department": "Computer Science", "Faculty Email": "john.doe@university.edu" }];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(facultyData), "Faculty");

        // Rooms
        const roomData = [{ "Room ID": "R101", "Room Name/Number": "Room 101", "Room Type": "Theory", "Capacity": 60, "Session": "2024-25" }];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(roomData), "Rooms");

        // Batches
        const batchData = [{ "Batch ID": "CSE-A", "Semester": "V", "Degree": "B.Tech", "Year": "Third Year", "Department": "CSE", "Session": "2024-25" }];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(batchData), "Batches");

        // Course Data
        const courseData = [{ 
            "Faculty ID": "FAC001", "Faculty Name": "Dr. John Doe", "Course Code": "CS301", "Subject": "Data Structures", 
            "Type": "Core", "Batch": "CSE-A", "Course L": 3, "Course T": 1, "Course P": 0, "Credits": 4, 
            "Semester": "V", "Program": "B.Tech", "Department": "CSE", "Session": "2024-25" 
        }];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(courseData), "Course Data");

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=university_full_template.xlsx');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

module.exports = router;
