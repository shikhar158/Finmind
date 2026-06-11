import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

import { getLocalDbFallback } from './dbFallback.js';

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('placeholder')) {
    console.warn('⚠️ MONGODB_URI is placeholder or missing, using local JSON fallback database.');
    return getLocalDbFallback();
  }
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    cachedDb = client.db();
    return cachedDb;
  } catch (err) {
    console.warn('⚠️ MongoDB Connection failed, falling back to local JSON database:', err.message);
    return getLocalDbFallback();
  }
}

export default async function handler(req, res) {
  try {
    const db = await connectToDatabase();
    const users = db.collection('users');

    // Authentication Middleware inside function
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = ObjectId.isValid(decoded.id) ? new ObjectId(decoded.id) : decoded.id;

    // Handle GET /api/portfolio -> Get Portfolio
    if (req.method === 'GET') {
      const user = await users.findOne({ _id: userId }, { projection: { portfolio: 1 } });
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      
      return res.json({ success: true, portfolio: user.portfolio });
    }

    // Handle POST /api/portfolio -> Add/Update Portfolio
    if (req.method === 'POST') {
      await users.updateOne({ _id: userId }, { $set: { portfolio: req.body } });
      return res.json({ success: true, message: 'Portfolio updated successfully' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('Portfolio Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
