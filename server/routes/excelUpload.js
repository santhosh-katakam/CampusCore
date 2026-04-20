const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const router = express.Router();

// Models
const Faculty = require('../models/Faculty');
const Room = require('../models/Room');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Subject = require('../models/Subject');

const TimetableConfig = require('../models/TimetableConfig');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware to extract institutionId (consistent with api.js)
const getInstitutionId = (req) => req.headers['x-institution-id'] || process.env.DEFAULT_INSTITUTION_ID;

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

        // Process Faculty Sheet - Try multiple possible sheet names
        const facultySheetNames = Object.keys(sheets).filter(name =>
            name.toLowerCase().includes('faculty') ||
            name.toLowerCase().includes('employee') ||
            name === 'Sheet1' // Default Excel sheet name
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
                const hasEmpId = Object.keys(firstRow).some(key =>
                    key.toLowerCase().includes('emp') || key.toLowerCase().includes('faculty id')
                );
                if (hasEmpId) {
                    facultySheet = firstSheet;
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
            name.toLowerCase().includes('room') ||
            name === 'Sheet1' // Default Excel sheet name
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
                const hasRoomName = Object.keys(firstRow).some(key =>
                    key.toLowerCase().includes('room')
                );
                if (hasRoomName) {
                    roomSheet = firstSheet;
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
            name.toLowerCase().includes('batch') ||
            name === 'Sheet1' // Default Excel sheet name
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
                const hasBatch = Object.keys(firstRow).some(key =>
                    key.toLowerCase().includes('batch') || key.toLowerCase().includes('semester')
                );
                if (hasBatch) {
                    batchSheet = firstSheet;
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

                    const year = String(
                        row['Year'] ||
                        row['Academic Year'] ||
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
                        ''
                    ).trim();


                    if (!batchId || !semester || !degree || !year || !department || !session) {
                        results.batches.errors.push(`Missing required fields - Batch: ${batchId}, Semester: ${semester}, Degree: ${degree}, Year: ${year}, Dept: ${department}, Session: ${session}`);
                        continue;
                    }

                    // Convert year to number
                    let yearNumber = 1;
                    if (year.toLowerCase().includes('second') || year.includes('2')) yearNumber = 2;
                    else if (year.toLowerCase().includes('third') || year.includes('3')) yearNumber = 3;
                    else if (year.toLowerCase().includes('fourth') || year.includes('4')) yearNumber = 4;

                    const existing = await Batch.findOne({ batchId, institutionId });
                    if (existing) {
                        await Batch.updateOne(
                            { batchId, institutionId },
                            {
                                name: batchId,
                                semester,
                                degree,
                                year,
                                yearNumber,
                                department,
                                session
                            }
                        );
                        results.batches.updated++;
                    } else {
                        await Batch.create({
                            batchId,
                            name: batchId,
                            semester,
                            degree,
                            year,
                            yearNumber,
                            department,
                            session,
                            institutionId
                        });
                        results.batches.added++;
                    }
                } catch (err) {
                    console.error('Error processing batch row:', err);
                    results.batches.errors.push(err.message);
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

                    // Create or update Subject
                    if (subject && courseCode) {
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

module.exports = router;
