import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'users_db.json');

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (err) {
    return [];
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

class MockCollection {
  async findOne(query, options = {}) {
    const users = readDb();
    const result = users.find(u => {
      for (const [key, val] of Object.entries(query)) {
        if (key === '_id') {
          const qId = val ? val.toString() : '';
          const uId = u._id ? u._id.toString() : '';
          if (qId !== uId) return false;
        } else if (u[key] !== val) {
          return false;
        }
      }
      return true;
    });

    if (result && options.projection) {
      const projected = { ...result };
      for (const [key, val] of Object.entries(options.projection)) {
        if (val === 0) {
          delete projected[key];
        }
      }
      return projected;
    }
    return result;
  }

  async insertOne(doc) {
    const users = readDb();
    if (!doc._id) {
      doc._id = Math.random().toString(36).substring(2, 15);
    }
    users.push(doc);
    writeDb(users);
    return { insertedId: doc._id };
  }

  async updateOne(query, update) {
    const users = readDb();
    let matchedCount = 0;

    const updatedUsers = users.map(u => {
      let isMatch = true;
      for (const [key, val] of Object.entries(query)) {
        if (key === '_id') {
          const qId = val ? val.toString() : '';
          const uId = u._id ? u._id.toString() : '';
          if (qId !== uId) isMatch = false;
        } else if (key === 'history._id') {
          const logIdStr = val ? val.toString() : '';
          const hasLog = u.history && u.history.some(h => h._id && h._id.toString() === logIdStr);
          if (!hasLog) isMatch = false;
        } else if (u[key] !== val) {
          isMatch = false;
        }
      }

      if (isMatch) {
        matchedCount++;
        if (update.$set) {
          for (const [k, v] of Object.entries(update.$set)) {
            if (k.startsWith('history.$.')) {
              const field = k.replace('history.$.', '');
              const logIdStr = query['history._id'] ? query['history._id'].toString() : '';
              if (u.history) {
                u.history = u.history.map(h => {
                  if (h._id && h._id.toString() === logIdStr) {
                    h[field] = v;
                  }
                  return h;
                });
              }
            } else {
              u[k] = v;
            }
          }
        }
        if (update.$push) {
          for (const [k, v] of Object.entries(update.$push)) {
            if (!u[k]) u[k] = [];
            u[k].push(v);
          }
        }
      }
      return u;
    });

    writeDb(updatedUsers);
    return { matchedCount };
  }
}

class MockDb {
  collection(name) {
    if (name === 'users') {
      return new MockCollection();
    }
    throw new Error(`Mock db doesn't support collection ${name}`);
  }
}

export function getLocalDbFallback() {
  return new MockDb();
}
