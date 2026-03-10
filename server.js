const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json({ limit: '1mb' }));

// ---- Health check ----
app.get('/health', (req, res) => {
  res.json({ status: 'ok', tts: !!process.env.GOOGLE_TTS_KEY });
});

// Google Cloud TTS — Neural2 modeli (çok daha doğal)
const VOICE_CONFIG = {
  esma: {
    // Genç kadın — Neural2-D
    name: 'tr-TR-Neural2-D',
    ssmlGender: 'FEMALE',
    speakingRate: 0.92,
    pitch: 1.5,
  },
  nergis: {
    // Olgun, yumuşak kadın — Neural2-A
    name: 'tr-TR-Neural2-A',
    ssmlGender: 'FEMALE',
    speakingRate: 0.86,
    pitch: -0.5,
  },
  kemal: {
    // Derin, olgun erkek — Neural2-B
    name: 'tr-TR-Neural2-B',
    ssmlGender: 'MALE',
    speakingRate: 0.80,
    pitch: -3.0,
  },
};

// ---- TTS endpoint ----
app.post('/tts', async (req, res) => {
  const { narrator, text } = req.body;

  if (!text || !narrator) {
    return res.status(400).json({ error: 'narrator ve text zorunlu' });
  }

  if (text.length > 3000) {
    return res.status(400).json({ error: 'Metin çok uzun (max 3000 karakter)' });
  }

  const apiKey = (process.env.GOOGLE_TTS_KEY || '').replace(/^["']|["']$/g, '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'Google TTS API key tanımlı değil' });
  }

  const voice = VOICE_CONFIG[narrator] || VOICE_CONFIG.nergis;

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'tr-TR',
            name: voice.name,
            ssmlGender: voice.ssmlGender,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: voice.speakingRate,
            pitch: voice.pitch,
            effectsProfileId: ['headphone-class-device'],
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('Google TTS error:', JSON.stringify(data.error || data));
      return res.status(response.status || 500).json({ 
        error: data.error?.message || 'Google TTS hatası' 
      });
    }

    const audioBuffer = Buffer.from(data.audioContent, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(audioBuffer);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✦ Fal TTS proxy çalışıyor → http://localhost:${PORT}`);
  const key = (process.env.GOOGLE_TTS_KEY || '').replace(/^["']|["']$/g, '').trim();
  console.log(`  Google TTS key: ${key ? '✓ tanımlı (ilk 8: ' + key.substring(0, 8) + ')' : '✗ EKSİK'}`);
});
