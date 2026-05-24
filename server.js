const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const { instagramDownload } = require('@mrnima/instagram-downloader');
const db = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helpers
async function downloadFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
      'Referer': 'https://www.instagram.com/'
    },
    timeout: 30000
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getMockMedia(url) {
  const isVideo = url.includes('/reel/') || url.includes('/tv/') || url.toLowerCase().includes('video');
  const captionMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
  const code = captionMatch ? captionMatch[1] : 'InstaPost';
  
  if (isVideo) {
    const videos = [
      'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4',
      'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-ocean-near-a-cliff-43028-large.mp4',
      'https://assets.mixkit.co/videos/preview/mixkit-neon-light-from-a-retro-arcade-game-41872-large.mp4'
    ];
    const index = Math.abs(hashCode(code)) % videos.length;
    return {
      media_url: videos[index],
      thumbnail_url: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop',
      media_type: 'video',
      caption: `[DEMO] Beautiful Reel by @instagram_user (Post Code: ${code})`,
      is_mock: 1
    };
  } else {
    const images = [
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1080&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1080&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1080&auto=format&fit=crop'
    ];
    const index = Math.abs(hashCode(code)) % images.length;
    return {
      media_url: images[index],
      thumbnail_url: images[index],
      media_type: 'image',
      caption: `[DEMO] High-resolution photo from Instagram (Post Code: ${code})`,
      is_mock: 1
    };
  }
}

async function scrapeMetaTags(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });
    const html = response.data;
    
    const videoRegex = /<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i;
    const videoMatch = html.match(videoRegex);
    
    const imageRegex = /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i;
    const imageMatch = html.match(imageRegex);
    
    const descRegex = /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i;
    const descMatch = html.match(descRegex);
    const caption = descMatch ? descMatch[1] : 'Instagram Post';
    
    if (videoMatch) {
      return {
        media_url: videoMatch[1].replace(/&amp;/g, '&'),
        thumbnail_url: imageMatch ? imageMatch[1].replace(/&amp;/g, '&') : '',
        media_type: 'video',
        caption,
        is_mock: 0
      };
    } else if (imageMatch) {
      return {
        media_url: imageMatch[1].replace(/&amp;/g, '&'),
        thumbnail_url: imageMatch[1].replace(/&amp;/g, '&'),
        media_type: 'image',
        caption,
        is_mock: 0
      };
    }
    throw new Error('No media metadata found in HTML');
  } catch (error) {
    console.error('Meta scraping failed, returning mock fallback:', error.message);
    return getMockMedia(url);
  }
}

// Routes
app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'Instagram URL is required' });
  }

  // Validate Instagram URL basic structure
  const isIgUrl = /instagram\.com\/(p|reel|tv|stories)/i.test(url);
  if (!isIgUrl) {
    return res.status(400).json({ error: 'Please enter a valid Instagram URL (e.g. instagram.com/p/... or instagram.com/reel/...)' });
  }

  try {
    let result = null;
    
    try {
      console.log('Resolving using @mrnima/instagram-downloader...');
      const data = await instagramDownload(url);
      
      if (data && data.status) {
        if (Array.isArray(data.result) && data.result.length > 0) {
          const item = data.result[0];
          const media_url = item.url || item.download_link || item.media;
          const thumbnail_url = item.thumbnail || item.thumb || item.preview || '';
          const isVideo = (item.type && item.type.includes('video')) || 
                          (media_url && media_url.includes('.mp4')) || 
                          item.is_video;
          result = {
            media_url,
            thumbnail_url,
            media_type: isVideo ? 'video' : 'image',
            caption: data.caption || item.caption || 'Instagram Media',
            is_mock: 0
          };
        } else if (data.result && typeof data.result === 'object') {
          const item = data.result;
          const media_url = item.url || item.download_link || item.media;
          const thumbnail_url = item.thumbnail || item.thumb || item.preview || '';
          const isVideo = (item.type && item.type.includes('video')) || 
                          (media_url && media_url.includes('.mp4')) || 
                          item.is_video;
          result = {
            media_url,
            thumbnail_url,
            media_type: isVideo ? 'video' : 'image',
            caption: data.caption || item.caption || 'Instagram Media',
            is_mock: 0
          };
        }
      }
    } catch (err) {
      console.error('Downloader package error, trying metadata fallback:', err.message);
    }

    // Fallback if downloader library did not return valid result
    if (!result) {
      result = await scrapeMetaTags(url);
    }

    // Download files locally to support permanent offline viewing and prevent link expirations
    let localMediaUrl = result.media_url;
    let localThumbUrl = result.thumbnail_url;
    
    try {
      const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const downloadsDir = path.join(__dirname, 'public', 'downloads');
      
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      // 1. Download primary media file
      const mediaExt = result.media_type === 'video' ? 'mp4' : 'jpg';
      const mediaFilename = `media_${uniqueId}.${mediaExt}`;
      const localMediaFilePath = path.join(downloadsDir, mediaFilename);
      
      console.log(`Downloading media file to: ${localMediaFilePath}`);
      await downloadFile(result.media_url, localMediaFilePath);
      localMediaUrl = `/downloads/${mediaFilename}`;
      console.log(`Successfully downloaded media to: ${localMediaUrl}`);

      // 2. Download thumbnail if it exists
      if (result.thumbnail_url) {
        const thumbFilename = `thumb_${uniqueId}.jpg`;
        const localThumbFilePath = path.join(downloadsDir, thumbFilename);
        
        console.log(`Downloading thumbnail file to: ${localThumbFilePath}`);
        await downloadFile(result.thumbnail_url, localThumbFilePath);
        localThumbUrl = `/downloads/${thumbFilename}`;
        console.log(`Successfully downloaded thumbnail to: ${localThumbUrl}`);
      } else {
        localThumbUrl = localMediaUrl;
      }
    } catch (err) {
      console.error('File local download failed, falling back to remote CDN urls:', err.message);
    }

    // Save record to DB
    const saved = await db.saveDownload({
      original_url: url,
      media_type: result.media_type,
      media_url: localMediaUrl,
      thumbnail_url: localThumbUrl,
      caption: result.caption,
      is_mock: result.is_mock
    });

    res.json(saved);
  } catch (error) {
    console.error('Server processing error:', error.message);
    res.status(500).json({ error: 'Failed to process Instagram link: ' + error.message });
  }
});

app.get('/api/history', async (req, res) => {
  const { search, type } = req.query;
  try {
    const rows = await db.getHistory(search, type);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

app.delete('/api/history/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const record = await db.getDownload(id);
    const success = await db.deleteDownload(id);
    
    if (success) {
      // Safely delete associated local files from the filesystem
      if (record) {
        if (record.media_url && record.media_url.startsWith('/downloads/')) {
          const localMediaPath = path.join(__dirname, 'public', record.media_url);
          fs.unlink(localMediaPath, (err) => {
            if (err) console.error('Failed to delete local media file:', err.message);
            else console.log('Successfully deleted local media file:', localMediaPath);
          });
        }
        if (record.thumbnail_url && record.thumbnail_url.startsWith('/downloads/')) {
          const localThumbPath = path.join(__dirname, 'public', record.thumbnail_url);
          fs.unlink(localThumbPath, (err) => {
            if (err) console.error('Failed to delete local thumbnail file:', err.message);
            else console.log('Successfully deleted local thumbnail file:', localThumbPath);
          });
        }
      }
      res.json({ success: true, message: 'Log and associated files deleted successfully' });
    } else {
      res.status(404).json({ error: 'Record not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete record: ' + error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Proxy streaming endpoint to avoid CORS issues on Instagram/other remote CDNs
app.get('/api/proxy', async (req, res) => {
  const mediaUrl = req.query.url;
  const mediaId = req.query.id;
  if (!mediaUrl) {
    return res.status(400).send('Missing media url query parameter');
  }

  // Increment download count if database ID is provided
  if (mediaId) {
    try {
      await db.incrementDownloadCount(mediaId);
      console.log(`Incremented download count for ID: ${mediaId}`);
    } catch (err) {
      console.error('Failed to increment download count in proxy:', err.message);
    }
  }

  // If the media URL is a locally saved file, serve it directly
  if (mediaUrl.startsWith('/downloads/')) {
    const localFilePath = path.join(__dirname, 'public', mediaUrl);
    if (fs.existsSync(localFilePath)) {
      const ext = path.extname(localFilePath);
      return res.download(localFilePath, `instasnap_${mediaId || Date.now()}${ext}`);
    }
  }

  try {
    const response = await axios.get(mediaUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/'
      },
      timeout: 20000
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const contentLength = response.headers['content-length'];

    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    const ext = contentType.includes('video') ? 'mp4' : 'jpg';
    res.setHeader('Content-Disposition', `attachment; filename="instasnap_${Date.now()}.${ext}"`);

    response.data.pipe(res);
  } catch (error) {
    console.error('Media proxy stream failed. Redirecting as fallback:', error.message);
    res.redirect(mediaUrl);
  }
});

// Serve frontend home fallback
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
