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

// Google Cloud TTS ses ayarları — her falcı için
const VOICE_CONFIG = {
  esma: {
    // Genç, dramatik kadın — tr-TR-Wavenet-E
    languageCode: 'tr-TR',
    name: 'tr-TR-Wavenet-E',
    ssmlGender: 'FEMALE',
    speakingRate: 0.90,
    pitch: 2.0,
  },
  nergis: {
    // Orta yaşlı, yumuşak kadın — tr-TR-Wavenet-A
    languageCode: 'tr-TR',
    name: 'tr-TR-Wavenet-A',
    ssmlGender: 'FEMALE',
    speakingRate: 0.85,
    pitch: 0.0,
  },
  kemal: {
    // Derin, olgun erkek — tr-TR-Wavenet-B
    languageCode: 'tr-TR',
    name: 'tr-TR-Wavenet-B',
    ssmlGender: 'MALE',
    speakingRate: 0.80,
    pitch: -2.0,
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
            languageCode: voice.languageCode,
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
      console.error('Google TTS error:', data.error || data);
      return res.status(response.status).json({ error: data.error?.message || 'Google TTS hatası' });
    }

    // base64 MP3'ü binary'e çevir ve gönder
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
