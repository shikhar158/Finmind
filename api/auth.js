import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
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

    // Handle GET /api/auth -> Current User (Me)
    if (req.method === 'GET') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userQueryId = ObjectId.isValid(decoded.id) ? new ObjectId(decoded.id) : decoded.id;
      const user = await users.findOne({ _id: userQueryId }, { projection: { password: 0 } });
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });

      return res.json({ success: true, user });
    }

    // Handle POST /api/auth -> Register / Login
    if (req.method === 'POST') {
      const { action, name, email, password } = req.body;

      if (action === 'register') {
        if (!name || !email || !password) return res.status(400).json({ success: false, error: 'Missing fields' });
        
        const existingUser = await users.findOne({ email: email.toLowerCase() });
        if (existingUser) return res.status(400).json({ success: false, error: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          createdAt: new Date(),
          onboardingDone: false,
          profile: {},
          portfolio: null,
          stressAnalysis: null,
          history: []
        };

        const result = await users.insertOne(newUser);
        const token = jwt.sign({ id: result.insertedId }, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.status(201).json({ 
          success: true, 
          token, 
          user: { name, email: email.toLowerCase(), onboardingDone: false } 
        });
      } 
      
      if (action === 'login') {
        if (!email || !password) return res.status(400).json({ success: false, error: 'Missing fields' });

        const user = await users.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(400).json({ success: false, error: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, error: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.json({ 
          success: true, 
          token, 
          user: { name: user.name, email: user.email, onboardingDone: user.onboardingDone } 
        });
      }

      if (action === 'forgot_password') {
        const { name, email, newPassword } = req.body;
        if (!name || !email || !newPassword) return res.status(400).json({ success: false, error: 'Missing fields' });

        const user = await users.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(400).json({ success: false, error: 'User not found' });

        // Basic verification: Name must match (case-insensitive)
        if (user.name.toLowerCase() !== name.toLowerCase()) {
          return res.status(400).json({ success: false, error: 'Verification failed. Name does not match.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await users.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

        return res.json({ success: true, message: 'Password reset successful.' });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    // Handle PUT /api/auth -> Update User
    if (req.method === 'PUT') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Remove sensitive or non-updatable fields if they exist in body
      const { password, email, _id, ...updateData } = req.body;

      // Handle password update if password is provided in body
      if (req.body.password) {
         const salt = await bcrypt.genSalt(10);
         updateData.password = await bcrypt.hash(req.body.password, salt);
      }

      const userQueryId = ObjectId.isValid(decoded.id) ? new ObjectId(decoded.id) : decoded.id;
      await users.updateOne({ _id: userQueryId }, { $set: updateData });
      
      const updatedUser = await users.findOne({ _id: userQueryId }, { projection: { password: 0 } });
      return res.json({ success: true, user: updatedUser });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('Auth Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
