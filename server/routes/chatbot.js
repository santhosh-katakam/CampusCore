const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const Timetable = require('../models/Timetable');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Fallback Knowledge Base (in case API is unavailable)
const LOCAL_KB = {
    'dsa': "DSA stands for Data Structures and Algorithms. It is a foundational area of computer science focused on efficiently organizing, storing, and processing data.",
    'oops': "OOPS stands for Object-Oriented Programming System. Key concepts include Abstraction, Encapsulation, Inheritance, and Polymorphism.",
    'scheduler': "Our portal uses a custom Greedy Heuristic Algorithm to generate timetables without faculty or room clashes.",
    'lms': "The LMS allows students and faculty to manage course materials, assignments, and take quizzes."
};

router.post('/', async (req, res) => {
    const { message, context } = req.body;
    const msg = message.toLowerCase();

    let studentTimetable = null;
    if (context.batch) {
        try {
            studentTimetable = await Timetable.findOne({ batch: context.batch }).lean();
        } catch (err) {
            console.error("Error fetching timetable for chatbot:", err);
        }
    }

    // If no API key, use local fallback
    if (!openai) {
        let reply = "The system is currently in Local Mode. I can help with portal orientation or basic academic terms like DSA or OOPS. For your specific schedule, please use the Timetable tab.";
        for (const key in LOCAL_KB) {
            if (msg.includes(key)) reply = LOCAL_KB[key];
        }
        return res.json({ reply });
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
                        You are the "Smart Timetable AI Assistant".
                        Identity: professional, helpful, academic.
                        Context: This is a college management portal.
                        User: ${context.user || 'Student'} (Role: ${context.role || 'Student'}, Batch: ${context.batch || 'N/A'})
                        
                        Current Date/Time: ${new Date().toLocaleString()} (Day: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })})
                        
                        Timetable Data for this User:
                        ${studentTimetable ? JSON.stringify(studentTimetable.schedule) : 'No timetable found for this batch.'}

                        Period Mapping:
                        1: 9:00 - 10:00
                        2: 10:00 - 11:00
                        3: 11:00 - 12:00
                        4: 12:00 - 1:00 (Lunch is usually Period 4 or according to config)
                        5: 1:00 - 2:00
                        6: 2:00 - 3:00
                        7: 3:00 - 4:00
                        8: 4:00 - 5:00

                        Capabilities:
                        - If the user asks "Where is my class?" or "What class do I have at [time] on [day]?", look specifically at the provided 'Timetable Data'.
                        - Match the requested Day (e.g., Monday) and Period (matching the time).
                        - Provide the Subject and the Room.
                        - If the user doesn't specify a date/time, assume they mean CURRENT day/time based on the 'Current Date/Time' provided above.
                        - If no timetable is found, politely explain how to use the Student Portal to find it.
                        
                        Academic Support: Answer any question (DSA, OOPS, etc.).
                    `
                },
                { role: "user", content: message }
            ],
            max_tokens: 500,
        });

        res.json({ reply: response.choices[0].message.content });
    } catch (err) {
        console.error("OpenAI API Error:", err.message);
        
        // Fallback to local KB on API failure
        let fallbackReply = "I'm having a bit of trouble connecting to my central brain, but I can tell you that " + (LOCAL_KB[msg] || "this portal is designed to make your academic life easier!");
        for (const key in LOCAL_KB) {
            if (msg.includes(key)) fallbackReply = LOCAL_KB[key];
        }
        
        res.json({ reply: fallbackReply });
    }
});

module.exports = router;
