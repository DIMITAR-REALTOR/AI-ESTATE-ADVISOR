// api/analyze.js
// Vercel Serverless Function — proxy to Groq API
// The API key is stored securely server-side via environment variable

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server configuration error: GROQ_API_KEY not set' });
    return;
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }

    const https = require('https');
    const url = new URL('https://api.groq.com/openai/v1/chat/completions');

    const postData = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    });

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const groqReq = https.request(options, (groqRes) => {
      let data = '';
      groqRes.on('data', (chunk) => { data += chunk; });
      groqRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (groqRes.statusCode >= 200 && groqRes.statusCode < 300) {
            res.status(200).json(parsed);
          } else {
            res.status(groqRes.statusCode || 500).json({ 
              error: 'Groq API error', 
              details: parsed 
            });
          }
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse Groq response', raw: data });
        }
      });
    });

    groqReq.on('error', (error) => {
      res.status(500).json({ error: 'Request failed', message: error.message });
    });

    groqReq.write(postData);
    groqReq.end();

  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
