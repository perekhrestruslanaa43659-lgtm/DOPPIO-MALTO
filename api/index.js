// Vercel Serverless Function Wrapper
// This file exports the Express app for Vercel's serverless environment

// Import the main server app from backend directory
const app = require('../backend/server');

// Export for Vercel
module.exports = app;

