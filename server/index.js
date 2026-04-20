const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const api = require('./routes/api');
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const lmsRoutes = require('./routes/lms');
const attendanceRoutes = require('./routes/attendance');
const jobRoutes = require('./routes/jobs');
const chatbotRoutes = require('./routes/chatbot');
const authMiddleware = require('./middleware/auth');

require('dotenv').config();

const app = express();
const connectDB = require('./config/db');

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(authMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api', api);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  // server.close(() => process.exit(1));
});
