const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'downloads.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database at:', dbPath);
    initializeSchema();
  }
});

function initializeSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_url TEXT NOT NULL,
      media_type TEXT NOT NULL,
      media_url TEXT NOT NULL,
      thumbnail_url TEXT,
      caption TEXT,
      is_mock INTEGER DEFAULT 0,
      download_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating downloads table:', err.message);
    } else {
      console.log('Downloads table verified/created.');
      // Execute column migration if it is missing
      db.run("ALTER TABLE downloads ADD COLUMN download_count INTEGER DEFAULT 0", (alterErr) => {
        if (alterErr) {
          // If error because it already exists, that is fine and expected
          if (!alterErr.message.includes('duplicate column name')) {
             console.log('Database migration notice:', alterErr.message);
          }
        } else {
          console.log('Database migration successful: added download_count column.');
        }
      });
    }
  });
}

// Wrap db operations in Promises for clean async/await syntax
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

/**
 * Saves a download record.
 */
async function saveDownload({ original_url, media_type, media_url, thumbnail_url, caption, is_mock = 0 }) {
  const sql = `
    INSERT INTO downloads (original_url, media_type, media_url, thumbnail_url, caption, is_mock)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const result = await dbRun(sql, [original_url, media_type, media_url, thumbnail_url, caption, is_mock]);
  return {
    id: result.id,
    original_url,
    media_type,
    media_url,
    thumbnail_url,
    caption,
    is_mock,
    download_count: 0,
    created_at: new Date().toISOString()
  };
}

/**
 * Retrieves download history with optional search and type filtering.
 */
async function getHistory(search = '', type = 'all') {
  let sql = 'SELECT * FROM downloads WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (caption LIKE ? OR original_url LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam);
  }

  if (type && type !== 'all') {
    sql += ' AND media_type = ?';
    params.push(type);
  }

  sql += ' ORDER BY created_at DESC';
  return await dbAll(sql, params);
}

/**
 * Retrieves a single download record by ID.
 */
async function getDownload(id) {
  const sql = 'SELECT * FROM downloads WHERE id = ?';
  return await dbGet(sql, [id]);
}

/**
 * Deletes a single download log.
 */
async function deleteDownload(id) {
  const sql = 'DELETE FROM downloads WHERE id = ?';
  const result = await dbRun(sql, [id]);
  return result.changes > 0;
}

/**
 * Increments the download count for a specific record.
 */
async function incrementDownloadCount(id) {
  const sql = 'UPDATE downloads SET download_count = download_count + 1 WHERE id = ?';
  const result = await dbRun(sql, [id]);
  return result.changes > 0;
}

/**
 * Retrieves statistics for the dashboard.
 */
async function getStats() {
  const totalSql = 'SELECT COUNT(*) as count FROM downloads';
  const videoSql = "SELECT COUNT(*) as count FROM downloads WHERE media_type = 'video'";
  const imageSql = "SELECT COUNT(*) as count FROM downloads WHERE media_type = 'image'";
  const mockSql = 'SELECT COUNT(*) as count FROM downloads WHERE is_mock = 1';
  const downloadsSql = 'SELECT SUM(download_count) as count FROM downloads';

  const [total, videos, images, mocks, downloads] = await Promise.all([
    dbGet(totalSql),
    dbGet(videoSql),
    dbGet(imageSql),
    dbGet(mockSql),
    dbGet(downloadsSql)
  ]);

  return {
    total: total.count,
    videos: videos.count,
    images: images.count,
    mocks: mocks.count,
    downloads: downloads.count || 0
  };
}

module.exports = {
  saveDownload,
  getHistory,
  getDownload,
  deleteDownload,
  getStats,
  incrementDownloadCount,
  dbPath
};
