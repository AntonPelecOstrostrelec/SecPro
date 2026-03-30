require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load Vercel-style API routes for local development
const sendResetCode = require('./api/send-reset-code');
const verifyResetCode = require('./api/verify-reset-code');
const leads = require('./api/leads');
const leadDetail = require('./api/lead-detail');
const aiGenerate = require('./api/ai-generate');

app.all('/api/send-reset-code', sendResetCode);
app.all('/api/verify-reset-code', verifyResetCode);
app.all('/api/leads', leads);
app.all('/api/lead-detail', leadDetail);
app.all('/api/ai-generate', aiGenerate);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FINIO server running at http://localhost:${PORT}`);
});
