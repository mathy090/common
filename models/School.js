// models/School.js
const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // Prevents duplicates
    trim: true
  },
  location: {
    type: String,
    trim: true,
    default: "Zimbabwe" // Default if not provided
  },
  type: {
    type: String,
    required: true,
    default: "Primary",
    enum: ["Nursery", "Primary", "Secondary", "College", "University", "Other"] // Restrict values
  },
  description: { type: String, trim: true },
  website: { type: String, trim: true },
  // Add any other fields you might want later
}, {
  timestamps: true // Adds createdAt, updatedAt
});

module.exports = mongoose.model('School', schoolSchema);