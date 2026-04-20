const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');
const Faculty = require('../models/Faculty');
const Room = require('../models/Room');

// GET /api/faculty-availability
// Returns a matrix of availability for all faculty
router.get('/availability', async (req, res) => {
    try {
        // 1. Get all faculty & rooms
        const allFaculty = await Faculty.find({}, 'name department');
        const totalFacultyCount = allFaculty.length;

        const allRooms = await Room.find({}, 'name type capacity');
        const totalRoomCount = allRooms.length;

        // 2. Get all timetables to find busy slots
        const allTimetables = await Timetable.find({});

        // 3. Initialize availability matrix
        // 5 Days x 8 Periods
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const periods = [1, 2, 3, 4, 5, 6, 7, 8];

        const matrix = days.map(day => {
            return {
                day,
                periods: periods.map(period => {
                    return {
                        period,
                        totalFaculty: totalFacultyCount,
                        busyFaculty: new Set(),
                        busyRooms: new Set(),
                        // available will be calculated
                    };
                })
            };
        });

        // 4. Fill busy slots
        allTimetables.forEach(tt => {
            tt.schedule.forEach(daySch => {
                const dayIndex = days.indexOf(daySch.day);
                if (dayIndex === -1) return;

                daySch.periods.forEach(p => {
                    const pIndex = periods.indexOf(p.period); // Define once for both checks

                    // Check if period is busy (assigned to a faculty)
                    if (p.faculty && p.faculty.trim() !== "") {
                        if (pIndex !== -1) {
                            matrix[dayIndex].periods[pIndex].busyFaculty.add(p.faculty);
                        }
                    }

                    // Check if room is busy
                    if (p.room && p.room.trim() !== "") {
                        if (pIndex !== -1) {
                            matrix[dayIndex].periods[pIndex].busyRooms.add(p.room);
                        }
                    }
                });
            });
        });

        // 5. Format response
        const responseCallback = matrix.map(d => ({
            day: d.day,
            periods: d.periods.map(p => {
                const busySet = p.busyFaculty;
                const availableFacultyList = allFaculty.filter(f => !busySet.has(f.name));

                // Process Rooms
                const busyRoomSet = p.busyRooms;
                const availableRoomList = allRooms.filter(r => !busyRoomSet.has(r.name));

                return {
                    period: p.period,

                    // Faculty Data
                    totalFaculty: p.totalFaculty,
                    busyFacultyCount: busySet.size,
                    availableFacultyCount: availableFacultyList.length,
                    availableFaculty: availableFacultyList,
                    busyFacultyNames: Array.from(busySet),

                    // Room Data
                    totalRooms: totalRoomCount,
                    busyRoomCount: busyRoomSet.size,
                    availableRoomCount: availableRoomList.length,
                    availableRooms: availableRoomList,
                    busyRoomNames: Array.from(busyRoomSet)
                };
            })
        }));

        res.json(responseCallback);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
