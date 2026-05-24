const axios = require('axios');

async function test() {
  try {
    console.log('Fetching main page...');
    const response = await axios.get('https://snapins.ai/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
      }
    });
    console.log('Main page status:', response.status);
    console.log('Main page headers:', response.headers);
    
    const cookies = response.headers['set-cookie'] || [];
    console.log('Set-Cookie headers:', cookies);
    const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
    console.log('Cookie string to send:', cookieStr);
    
    const matches = response.data.match(/name="token" value="(.*?)"/);
    const token = matches ? matches[1] : null;
    console.log('Extracted token:', token);
    
    if (token) {
      console.log('Posting URL to action2.php...');
      const response2 = await axios.post(
        'https://snapins.ai/action2.php',
        new URLSearchParams({
          url: 'https://www.instagram.com/reel/DYPca0ZPzTr/',
          token: token
        }),
        {
          headers: {
            'Referer': 'https://snapins.ai/',
            'Cookie': cookieStr,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
          }
        }
      );
      console.log('Action status:', response2.status);
      console.log('Action response (first 200 chars):', response2.data.slice(0, 200));
      console.log('Action response (length):', response2.data.length);
      
      const pattern = /\("(\w+)",\d+,"(\w+)",(\d+),(\d+),\d+\)/;
      const matches2 = response2.data.match(pattern);
      console.log('Extract matches:', matches2);
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
  }
}

test();
