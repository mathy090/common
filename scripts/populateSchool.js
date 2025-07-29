// scripts/populateSchools.js
require('dotenv').config(); // Load environment variables
const mongoose = require('mongoose');
const School = require('../models/School'); // Adjust path if needed
const fs = require('fs').promises;

async function populateSchools() {
  try {
    // Connect to MongoDB using the URI from your .env file
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
        // Mongoose 6+ handles useNewUrlParser and useUnifiedTopology automatically
    });
    console.log("✅ Connected to MongoDB");

    // Read the JSON file
    console.log("Reading zim_schools.json...");
    const dataBuffer = await fs.readFile('./zim_schools.json'); // Path relative to where script is run
    const schoolsData = JSON.parse(dataBuffer);

    if (!Array.isArray(schoolsData) || schoolsData.length === 0) {
      throw new Error("Invalid or empty data in zim_schools.json");
    }

    console.log(`📂 Found ${schoolsData.length} potential schools in the JSON file.`);

    // Optional: Clear existing schools to avoid duplicates (BE CAREFUL!)
    // Uncomment the lines below if you want to clear the collection first.
    // console.log("Clearing existing schools...");
    // const deletedCount = await School.deleteMany({});
    // console.log(`🗑️  Deleted ${deletedCount.deletedCount} existing schools.`);

    // Insert data into MongoDB
    console.log("Inserting schools into MongoDB...");
    const insertedDocs = await School.insertMany(schoolsData, { ordered: false });
    console.log(`✅ Successfully inserted ${insertedDocs.length} new schools into the database.`);

    // Handle potential errors (like duplicates) after the insert
    if (insertedDocs.result && insertedDocs.result.writeErrors) {
        const errorCount = insertedDocs.result.writeErrors.length;
        const successCount = schoolsData.length - errorCount;
        console.log(`⚠️  Attempted to insert ${schoolsData.length} schools.`);
        console.log(`✅ ${successCount} schools were inserted successfully.`);
        console.log(`⚠️  ${errorCount} entries failed (likely due to duplicates or validation errors).`);
        // Optionally, log specific errors:
        // insertedDocs.result.writeErrors.forEach((err, index) => {
        //   console.error(`   -> Error ${index + 1}:`, err.errmsg || err.message);
        // });
    }

  } catch (error) {
    console.error("❌ Error populating schools:", error.message);
    // If it's not a write error handled above, re-throw for debugging
    if (!error.result || !error.result.writeErrors) {
        console.error("Full error details:", error);
    }
  } finally {
    // Ensure the database connection is closed
    if (mongoose.connection.readyState === 1) { // Check if connected
        await mongoose.connection.close();
        console.log("💾 MongoDB connection closed.");
    }
  }
}

// Run the function if this script is executed directly (e.g., 'node scripts/populateSchools.js')
if (require.main === module) {
  populateSchools();
}

module.exports = { populateSchools }; // Export for potential use elsewhere