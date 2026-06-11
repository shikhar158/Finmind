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

    // Authentication Middleware
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = ObjectId.isValid(decoded.id) ? new ObjectId(decoded.id) : decoded.id;

    // Handle POST /api/log -> Insert Emotion Log
    if (req.method === 'POST') {
      const logEntry = {
        _id: new ObjectId(),
        ...req.body,
        createdAt: new Date()
      };

      await users.updateOne(
        { _id: userId },
        { $push: { history: logEntry } }
      );

      return res.status(201).json({ 
        success: true, 
        message: 'Log inserted successfully', 
        logId: logEntry._id 
      });
    }

    // Handle PATCH /api/log -> Update user_action inside history log
    if (req.method === 'PATCH') {
      const { logId, user_action } = req.body;
      if (!logId) return res.status(400).json({ success: false, error: 'logId is required' });

      const historyQueryId = ObjectId.isValid(logId) ? new ObjectId(logId) : logId;
      const result = await users.updateOne(
        { _id: userId, "history._id": historyQueryId },
        { $set: { "history.$.user_action": user_action } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, error: 'Log entry not found' });
      }

      return res.json({ success: true, message: 'Log updated successfully' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('Log Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
