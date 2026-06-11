import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static assets from the current directory
app.use(express.static(__dirname));

// Route /api/:endpoint to api/:endpoint.js
app.all('/api/:endpoint', async (req, res) => {
  const { endpoint } = req.params;
  try {
    const modulePath = `./api/${endpoint}.js`;
    const module = await import(modulePath);
    if (module.default) {
      await module.default(req, res);
    } else {
      res.status(404).json({ success: false, error: `Handler not found for /api/${endpoint}` });
    }
  } catch (err) {
    console.error(`Error executing /api/${endpoint}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// For any other requests, serve index.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 FinMind Local Dev Server running on http://localhost:${PORT}`);
});
