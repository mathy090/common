// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address.'] // Basic email validation
    },
    password: {
        type: String,
        required: true,
        minlength: [8, 'Password must be at least 8 characters long.'],
        maxlength: [128, 'Password cannot exceed 128 characters.'],
        // We'll add custom validation for complexity in the pre-save hook
    },
    role: {
        type: String,
        default: 'student',
        enum: ['student', 'admin']
    }
}, {
    timestamps: true
});

// --- Enhanced Password Validation & Hashing ---
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const password = this.password;

    // --- Strong Password Validation (iOS-style) ---
    const errors = [];
    
    if (password.length < 8) {
        errors.push("Must be at least 8 characters.");
    }
    if (!/[A-Z]/.test(password)) {
        errors.push("Must contain at least one uppercase letter (A-Z).");
    }
    if (!/[a-z]/.test(password)) {
        errors.push("Must contain at least one lowercase letter (a-z).");
    }
    if (!/\d/.test(password)) {
        errors.push("Must contain at least one number (0-9).");
    }
    if (!/[^A-Za-z0-9]/.test(password)) { // Checks for any non-alphanumeric character
        errors.push("Must contain at least one special character (e.g., !@#$%^&*).");
    }

    if (errors.length > 0) {
        const error = new Error(`Password is too weak. ${errors.join(' ')}`);
        error.statusCode = 400; // Bad Request
        return next(error);
    }

    try {
        // --- Hash the password securely ---
        const saltRounds = 12; // Increased rounds for better security
        this.password = await bcrypt.hash(password, saltRounds);
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare passwords during login
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (err) {
        throw new Error(err);
    }
};

module.exports = mongoose.model('User', userSchema);