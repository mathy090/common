// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // For Google AI

dotenv.config();

const app = express();
const PORT = process.env.PORT || 1000;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ extended: true }));
// Serve static files if needed (e.g., for images, CSS if not using a bundler)
// app.use(express.static('public'));

// --- Database Connection ---
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
    console.error("❌ ERROR: MONGO_URI is not defined in the .env file.");
    process.exit(1);
}
mongoose.connect(mongoUri)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// --- Models ---
// Make sure these paths are correct relative to server.js
const User = require('./models/User');
const School = require('./models/School'); // Import the School model

// --- Auth Routes ---
app.use('/api/auth', require('./routes/auth'));

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verification Error:", err);
            return res.sendStatus(403); // Forbidden
        }
        req.user = user;
        next();
    });
};

// --- API Endpoints ---

// --- Existing: Get ALL Schools from Database ---
// This endpoint is now PUBLIC (no authenticateToken) so homepage can load it
app.get('/api/schools', async (req, res) => {
    // Optional: Add query parameters for search/filtering later
    // const searchTerm = req.query.q;
    try {
        console.log("🌐 Fetching ALL schools from database...");
        // Fetch all schools, sorted by name alphabetically
        const schools = await School.find({}).sort({ name: 1 });
        console.log(`✅ Fetched ${schools.length} schools from database.`);
        res.json(schools);
    } catch (err) {
        console.error('❌ Error fetching schools from DB:', err);
        res.status(500).json({ error: 'Failed to fetch schools from database.' });
    }
});

// --- Existing: Get specific school details by ID ---
app.get('/api/schools/:id', async (req, res) => {
    try {
        const schoolId = req.params.id;
        // Basic validation of ObjectId format (optional but good practice)
        if (!mongoose.Types.ObjectId.isValid(schoolId)) {
             return res.status(400).json({ error: 'Invalid school ID format' });
        }

        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }
        res.json(school);
    } catch (err) {
        console.error('Error fetching school by ID:', err);
        if (err.name === 'CastError') { // Specific error for invalid ObjectId
             return res.status(400).json({ error: 'Invalid school ID format' });
        }
        res.status(500).json({ error: 'Failed to fetch school details' });
    }
});

// --- Existing: Admin & School Detail Endpoints ---
// Keep your existing admin check and add school endpoints here
// e.g., app.get('/api/admin/check', ...), app.post('/api/admin/schools', ...)

// --- New: Basic Compare Endpoint (Optional backend support) ---
// For now, frontend does simple comparison. This is a placeholder.
app.post('/api/compare', authenticateToken, async (req, res) => {
    try {
        const { schoolIds } = req.body;

        if (!schoolIds || !Array.isArray(schoolIds) || schoolIds.length < 2) {
             return res.status(400).json({ error: 'Please provide an array of at least 2 school IDs to compare.' });
        }

        // Fetch school details from DB for comparison context (basic)
        const validIds = schoolIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        const schoolsToCompare = await School.find({ '_id': { $in: validIds } });

        if (schoolsToCompare.length < 2) {
            return res.status(400).json({ error: 'Could not find enough valid schools to compare.' });
        }

        // --- Simple Comparison Logic (Replace with AI later if needed) ---
        // This just returns the names for now, as frontend handles display
        const schoolNames = schoolsToCompare.map(s => s.name);

        res.json({
            message: "Schools selected for comparison.",
            schoolIds: validIds,
            schoolNames: schoolNames
        });

    } catch (err) {
        console.error('Error in /api/compare:', err);
        res.status(500).json({ error: 'An internal error occurred during comparison setup.' });
    }
});
// --- End Basic Compare Endpoint ---


// --- Existing: AI Narrative Generation Endpoint ---
// Keep your existing /api/ai/narrative endpoint
// app.post('/api/ai/narrative', authenticateToken, ... )

// --- Existing: AI Chat Endpoint ---
// Keep your existing /api/ai/chat endpoint - it should work with the frontend fix
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || message.trim() === '') {
             return res.status(400).json({ error: 'Message is required.' });
        }

        // --- Prepare prompt for Google AI ---
        // Customize this prompt based on your app's context
        const aiPrompt = `
        You are a helpful assistant for Zimbabwean students seeking information about schools, education, and scholarships in Zimbabwe.
        The user has asked: "${message}"
        Provide a relevant and informative response based on your knowledge. Be concise and helpful.
        Do not make up specific school names, websites, or scholarship details unless you are very confident.
        If unsure, advise checking official sources.
        Output the response directly, without markdown or extra text.
        `;

        console.log(`🤖 Sending request to Google AI for chat message: ${message.substring(0, 30)}...`);
        
        // --- Call Google AI ---
        if (!process.env.GOOGLE_AI_API_KEY) {
             console.error("❌ GOOGLE_AI_API_KEY is not defined in the .env file for chat.");
             return res.status(500).json({ error: 'Server configuration error: AI API key missing.' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Or gemini-1.5-pro

        const result = await model.generateContent(aiPrompt);
        const response = await result.response;
        const aiReplyRaw = response.text().trim();

        if (!aiReplyRaw) {
            throw new Error("Received empty or invalid response from Google AI.");
        }

        console.log(`🧠 AI chat reply generated (preview):`, aiReplyRaw.substring(0, 100) + '...');

        // --- Send the reply back to the frontend ---
        res.json({
            message: "Reply successfully generated by Google AI.",
            reply: aiReplyRaw
        });

    } catch (err) {
        console.error('💥 Error in /api/ai/chat (Google AI):', err);

        // --- Handle specific AI/API errors ---
        if (err.name && err.name.includes('GoogleGenerativeAI')) {
             console.error('Google AI Library Error Details:', err.message);
             let errorMessage = 'Check server logs for details.';
             if (err.message && (err.message.includes('API_KEY_INVALID') || err.message.includes('PERMISSION_DENIED'))) {
                 errorMessage = 'Google AI API error: Invalid API key or permission denied.';
             } else if (err.message && (err.message.includes('429') || err.message.includes('QUOTA'))) {
                 errorMessage = 'Google AI API error: Rate limit exceeded or quota insufficient.';
             } else if (err.message && err.message.includes('503')) {
                 errorMessage = 'Google AI API error: Service temporarily unavailable.';
             }
             return res.status(500).json({
                 error: `Google AI service error: ${errorMessage}`
             });
        } else if (err.response) {
            console.error('API Error Response (unexpected path):', err.response.data);
            return res.status(err.response.status).json({
                error: `Google AI service error (unexpected): ${err.response.data?.error?.message || 'Check server logs.'}`
            });
        } else {
            console.error('Unexpected error setting up or calling Google AI API:', err.message);
            return res.status(500).json({ error: 'An internal error occurred while contacting the Google AI service.' });
        }
    }
});
// --- End AI Chat Endpoint ---


// --- Basic Health Check ---
app.get('/', (req, res) => {
    res.json({ message: 'ZimCommonApp Backend API is running!', timestamp: new Date().toISOString() });
});

// --- Server Listener ---
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment Variables Loaded: MONGO_URI=${!!process.env.MONGO_URI}, PORT=${PORT}, JWT_SECRET=${!!process.env.JWT_SECRET}, GOOGLE_AI_API_KEY=${!!process.env.GOOGLE_AI_API_KEY}`);
});

// --- Graceful Shutdown (Optional but good practice) ---
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down server...');
    try {
        await mongoose.connection.close();
        console.log('💾 MongoDB connection closed.');
    } catch (err) {
        console.error('Error closing MongoDB connection:', err);
    }
    process.exit(0);
});
