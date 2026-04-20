import React, { useState, useEffect } from 'react';
import api from './api/axios';

function StudentPortal() {
    const [batches, setBatches] = useState([]);
    const [allTimetables, setAllTimetables] = useState([]);

    const [selectedDegree, setSelectedDegree] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedBatch, setSelectedBatch] = useState('');

    const [filteredBatches, setFilteredBatches] = useState([]);
    const [timetable, setTimetable] = useState(null);
    const [loading, setLoading] = useState(false);

    const PERIODS = [
        { id: 1, label: "9:00 - 10:00" },
        { id: 2, label: "10:00 - 11:00" },
        { id: 3, label: "11:00 - 12:00" },
        { id: 4, label: "12:00 - 1:00" },
        { id: 5, label: "1:00 - 2:00" },
        { id: 6, label: "2:00 - 3:00" },
        { id: 7, label: "3:00 - 4:00" },
        { id: 8, label: "4:00 - 5:00" },
    ];

    const [degrees, setDegrees] = useState(['Engineering', 'Arts', 'Science', 'Commerce']); // Default, will update dynamically
    const years = [1, 2, 3, 4];

    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchBatches();
        fetchAllTimetables();
    }, []);

    useEffect(() => {
        filterBatches();
    }, [selectedDegree, selectedYear, batches, searchTerm]);

    const fetchBatches = async () => {
        try {
            const res = await api.get('/batches');
            setBatches(res.data);
            setFilteredBatches(res.data);

            // Extract unique degrees/departments for the dropdown
            const uniqueDegrees = [...new Set(res.data.flatMap(b => {
                const terms = [];
                if (b.degree) terms.push(b.degree);
                if (b.department) terms.push(b.department);
                // Also parse "Engineering" from "1st Year - CSE - A" legacy names if needed, 
                // but better to rely on fields.
                return terms;
            }).filter(Boolean))].sort();

            if (uniqueDegrees.length > 0) {
                setDegrees(uniqueDegrees);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchAllTimetables = async () => {
        try {
            const res = await api.get('/timetables');
            setAllTimetables(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const filterBatches = () => {
        let filtered = batches;

        if (selectedDegree) {
            filtered = filtered.filter(b =>
                (b.department && b.department.toLowerCase() === selectedDegree.toLowerCase()) ||
                (b.degree && b.degree.toLowerCase() === selectedDegree.toLowerCase()) ||
                (b.name && b.name.toLowerCase().includes(selectedDegree.toLowerCase()))
            );
        }

        if (selectedYear) {
            const selYearNum = parseInt(selectedYear);
            filtered = filtered.filter(b => {
                // Priority 1: Check yearNumber (Number)
                if (b.yearNumber === selYearNum) return true;

                // Priority 2: Check year (String/Number) loosely
                if (b.year == selYearNum) return true;

                // Priority 3: Parse "Third", "3rd", etc. from year string
                const yStr = (b.year || "").toLowerCase();
                const nameStr = (b.name || "").toLowerCase();

                // Check year field
                if (selYearNum === 1 && (yStr.includes("first") || yStr.includes("1st"))) return true;
                if (selYearNum === 2 && (yStr.includes("second") || yStr.includes("2nd"))) return true;
                if (selYearNum === 3 && (yStr.includes("third") || yStr.includes("3rd"))) return true;
                if (selYearNum === 4 && (yStr.includes("fourth") || yStr.includes("4th"))) return true;

                // Fallback: Check Name (e.g. "1st Year...") if year field is missing/bad
                if (selYearNum === 1 && (nameStr.includes("1st year") || nameStr.includes("first year"))) return true;
                if (selYearNum === 2 && (nameStr.includes("2nd year") || nameStr.includes("second year"))) return true;
                if (selYearNum === 3 && (nameStr.includes("3rd year") || nameStr.includes("third year"))) return true;
                if (selYearNum === 4 && (nameStr.includes("4th year") || nameStr.includes("fourth year"))) return true;

                return false;
            });
        }

        if (searchTerm) {
            filtered = filtered.filter(b =>
                b.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredBatches(filtered);
    };

    const handleSearch = () => {
        if (!selectedBatch) {
            alert('Please select a batch from the dropdown');
            return;
        }

        setLoading(true);

        // Find timetable for selected batch
        const foundTimetable = allTimetables.find(tt => tt.batch === selectedBatch);

        if (foundTimetable) {
            setTimetable(foundTimetable);
        } else {
            alert('No timetable found for this batch. Please contact admin.');
            setTimetable(null);
        }

        setLoading(false);
    };

    const getCellStyle = (period) => {
        if (period.type === 'Lunch') return 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500 flex items-center justify-center font-bold tracking-wider';
        if (period.type === 'Free') return 'bg-gray-100 text-gray-400';

        if (period.type === 'Lab') {
            if (period.subjectType === 'Elective') {
                return 'bg-purple-100 text-purple-800 border-l-4 border-purple-500';
            }
            if (period.subjectType === 'Training' || period.type === 'Training') {
                return 'bg-orange-100 text-orange-800 border-l-4 border-orange-500';
            }
            return 'bg-blue-100 text-blue-800 border-l-4 border-blue-500';
        }

        if (period.type === 'Training' || period.subjectType === 'Training') {
            return 'bg-orange-100 text-orange-800 border-l-4 border-orange-500';
        }

        // Differentiate Core vs Elective
        if (period.subjectType === 'Elective') {
            return 'bg-pink-100 text-pink-800 border-l-4 border-pink-500';
        }
        // Default to Core (Green)
        return 'bg-green-100 text-green-800 border-l-4 border-green-500';
    };

    const renderPeriodDetails = (periodData) => {
        if (periodData?.isElective && Array.isArray(periodData.electiveAllocations) && periodData.electiveAllocations.length > 0) {
            return (
                <div className="space-y-1">
                    {periodData.electiveAllocations.map((alloc, idx) => (
                        <div key={`${alloc.subject}-${idx}`} className="text-[11px] leading-tight bg-pink-50/70 border border-pink-200 rounded px-1.5 py-1">
                            <div className="font-semibold text-gray-800">
                                {alloc.subject} ({alloc.mode || 'L'}){alloc.subjectCode ? ` (${alloc.subjectCode})` : ''}
                            </div>
                            <div className="text-gray-700">Faculty: {alloc.faculty}</div>
                            <div className="text-gray-700">Room: {alloc.room}</div>
                            {alloc.batches && alloc.batches.length > 0 && (
                                <div className="text-[10px] text-indigo-700 mt-0.5">Batches: {alloc.batches.join(', ')}</div>
                            )}
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="space-y-0.5 font-medium">
                <div>Faculty: {periodData.faculty}</div>
                <div>Room: {periodData.room}</div>
                {periodData.batches && periodData.batches.length > 0 && (
                    <div className="text-[10px] text-indigo-700 bg-indigo-50/50 rounded px-1 border border-indigo-100/50 inline-block mt-1">
                        Batches: {periodData.batches.join(', ')}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-extrabold text-indigo-900 mb-2">
                        🎓 Student Portal
                    </h1>
                    <p className="text-gray-600 text-lg">View Your Class Timetable</p>
                </div>

                {/* Selection Panel */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                        <span className="text-3xl mr-3">📚</span>
                        Find Your Timetable
                    </h2>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <input
                            type="text"
                            placeholder="🔍 Search for your batch (e.g., 'CSE 3rd Year', 'Batch A')..."
                            className="w-full p-4 border-2 border-indigo-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-lg shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {/* Degree Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Filter by Degree
                            </label>
                            <select
                                value={selectedDegree}
                                onChange={(e) => {
                                    setSelectedDegree(e.target.value);
                                    setSelectedBatch('');
                                }}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            >
                                <option value="">All Degrees</option>
                                {degrees.map(deg => (
                                    <option key={deg} value={deg}>{deg}</option>
                                ))}
                            </select>
                        </div>

                        {/* Year Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Filter by Year
                            </label>
                            <select
                                value={selectedYear}
                                onChange={(e) => {
                                    setSelectedYear(e.target.value);
                                    setSelectedBatch('');
                                }}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            >
                                <option value="">All Years</option>
                                {years.map(year => (
                                    <option key={year} value={year}>
                                        {year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : '4th Year'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Batch Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Select Batch <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedBatch}
                                onChange={(e) => setSelectedBatch(e.target.value)}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            >
                                <option value="">-- Select Batch --</option>
                                {filteredBatches.map(batch => (
                                    <option key={batch._id} value={batch.name}>{batch.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* View Timetable Button */}
                        <div className="flex items-end">
                            <button
                                onClick={handleSearch}
                                disabled={!selectedBatch || loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Loading...' : 'View Timetable'}
                            </button>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-sm text-blue-800">
                        <p>
                            <strong>Tip:</strong> Use the search bar for quick access, or filter by degree and year to find your batch.
                        </p>
                    </div>
                </div>

                {/* Timetable Display */}
                {timetable ? (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-800">{timetable.batch}</h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    Generated on: {new Date(timetable.createdAt).toLocaleDateString('en-US', {
                                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <button
                                onClick={() => window.print()}
                                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition shadow-md"
                            >
                                🖨️ Print
                            </button>
                        </div>


                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-gray-800">
                                <thead>
                                    <tr>
                                        <th className="p-3 border-2 border-gray-800 bg-indigo-100 text-left text-sm font-bold text-indigo-900 w-32">
                                            Time / Day
                                        </th>
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                                            <th key={day} className="p-3 border-2 border-gray-800 bg-indigo-100 text-center text-sm font-bold text-indigo-900">
                                                {day}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {PERIODS.map(period => {
                                        return (
                                            <tr key={period.id}>
                                                <td className="p-3 border-2 border-gray-800 bg-indigo-50 font-semibold text-indigo-900 text-xs align-top">
                                                    <div className="text-center">
                                                        <div className="font-bold">{period.label}</div>
                                                    </div>
                                                </td>
                                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                                                    const daySchedule = timetable.schedule.find(d => d.day === day);
                                                    const periodData = daySchedule?.periods.find(p => p.period === period.id);

                                                    return (
                                                        <td key={day} className="p-2 border-2 border-gray-800 align-top min-h-[80px]">
                                                            {periodData?.type === 'Lunch' ? (
                                                                <div className="bg-yellow-100 p-3 rounded text-center font-bold text-yellow-800">
                                                                    ☕ LUNCH
                                                                </div>
                                                            ) : periodData?.type !== 'Free' ? (
                                                                <div className={`p-2 min-h-[70px] ${getCellStyle(periodData)}`}>
                                                                    <div className="text-xs">
                                                                        <div className="font-bold mb-1">
                                                                            {periodData.subject} ({periodData.type})
                                                                        </div>
                                                                        {renderPeriodDetails(periodData)}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-gray-50 p-3 min-h-[70px] flex items-center justify-center">
                                                                    <span className="text-gray-400 italic text-xs">Free</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Legend */}
                        <div className="mt-6 flex gap-6 text-sm justify-center flex-wrap">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-green-100 border-l-4 border-green-500 rounded"></div>
                                <span className="font-medium">Core Lecture</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-pink-100 border-l-4 border-pink-500 rounded"></div>
                                <span className="font-medium">Elective Lecture</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-blue-100 border-l-4 border-blue-500 rounded"></div>
                                <span className="font-medium">Core Lab</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-purple-100 border-l-4 border-purple-500 rounded"></div>
                                <span className="font-medium">Elective Lab</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-orange-100 border-l-4 border-orange-500 rounded"></div>
                                <span className="font-medium">Training</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-yellow-100 border-l-4 border-yellow-500 rounded"></div>
                                <span className="font-medium">Lunch</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gray-100 rounded"></div>
                                <span className="font-medium">Free Period</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
                        <div className="text-8xl mb-4">📅</div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-2">No Timetable Selected</h3>
                        <p className="text-gray-500">Please select your degree, year, and batch above to view your timetable.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StudentPortal;

