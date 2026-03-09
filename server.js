const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*', // Production'da frontend URL'inizi yazın
}));
app.use(express.json({ limit: '1mb' }));

// ---- Health check ----
app.get('/health', (req, res) => {
  res.json({ status: 'ok', elevenlabs: !!process.env.ELEVENLABS_API_KEY });
});

// ---- TTS proxy endpoint ----
// POST /tts  { voiceId: string, text: string }
// Returns: audio/mpeg stream
app.post('/tts', async (req, res) => {
  const { voiceId, text, voiceSettings } = req.body;

  if (!text || !voiceId) {
    return res.status(400).json({ error: 'voiceId ve text zorunlu' });
  }

  if (text.length > 3000) {
    return res.status(400).json({ error: 'Metin çok uzun (max 3000 karakter)' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key sunucuda tanımlı değil' });
  }

  try {
    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: voiceSettings || {
            stability: 0.55,
            similarity_boost: 0.80,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elResponse.ok) {
      const errBody = await elResponse.json().catch(() => ({}));
      console.error('ElevenLabs error:', errBody);
      return res.status(elResponse.status).json({
        error: errBody?.detail?.message || 'ElevenLabs hatası',
      });
    }

    // Stream ses verisini direkt istemciye ilet
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    elResponse.body.pipe(res);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✦ Fal TTS proxy çalışıyor → http://localhost:${PORT}`);
  console.log(`  ElevenLabs key: ${process.env.ELEVENLABS_API_KEY ? '✓ tanımlı' : '✗ EKSİK'}`);
});
