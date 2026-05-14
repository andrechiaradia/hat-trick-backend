// api/pronunciation.js
//
// Backend Vercel — Hat Trick Challenge · Gol 02 (v3 — FUNCIONAL)
// Recebe áudio do navegador em base64, envia pra Azure Speech Pronunciation Assessment,
// e devolve nota de 0-100 + score palavra por palavra.
//
// Variáveis de ambiente necessárias na Vercel:
//   AZURE_KEY     → sua chave do Speech Service
//   AZURE_REGION  → ex: eastus
//
// VERSÃO 3 — corrigida: Azure retorna scores no nível superior do NBest[0]
// (não dentro de PronunciationAssessment.X). Esta versão lê do lugar certo.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { audio, mimeType, referenceText } = req.body || {};

    if (!audio || !referenceText) {
      return res.status(400).json({
        error: 'Missing required fields: audio (base64) and referenceText'
      });
    }

    const AZURE_KEY = process.env.AZURE_KEY;
    const AZURE_REGION = process.env.AZURE_REGION;

    if (!AZURE_KEY || !AZURE_REGION) {
      return res.status(500).json({
        error: 'Server not configured. Missing AZURE_KEY or AZURE_REGION env vars.'
      });
    }

    const audioBuffer = Buffer.from(audio, 'base64');

    // ─── Cabeçalho Pronunciation Assessment ───
    const pronunciationConfig = {
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Word",
      Dimension: "Comprehensive",
      EnableMiscue: false
    };
    const pronAssessmentHeader = Buffer.from(
      JSON.stringify(pronunciationConfig),
      'utf-8'
    ).toString('base64');

    // ─── Content-Type ───
    // Azure tem formato específico para cada tipo. Pra WAV PCM 16kHz mono,
    // o Content-Type EXATO é importante.
    let contentType;
    if (mimeType && mimeType.includes('wav')) {
      // WAV 16-bit PCM mono 16kHz — formato oficial recomendado pela Azure
      contentType = 'audio/wav; codecs=audio/pcm; samplerate=16000';
    } else if (mimeType && mimeType.includes('webm')) {
      contentType = 'audio/webm; codecs=opus';
    } else if (mimeType && mimeType.includes('ogg')) {
      contentType = 'audio/ogg; codecs=opus';
    } else if (mimeType && mimeType.includes('mp4')) {
      contentType = 'audio/mp4';
    } else {
      contentType = 'audio/wav; codecs=audio/pcm; samplerate=16000';
    }

    const azureUrl = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

    const azureResponse = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': contentType,
        'Accept': 'application/json',
        'Pronunciation-Assessment': pronAssessmentHeader
      },
      body: audioBuffer
    });

    if (!azureResponse.ok) {
      const errText = await azureResponse.text();
      console.error('Azure HTTP error:', azureResponse.status, errText);
      return res.status(502).json({
        error: 'Azure Speech API error',
        status: azureResponse.status,
        detail: errText
      });
    }

    const azureData = await azureResponse.json();

    if (azureData.RecognitionStatus !== 'Success') {
      return res.status(200).json({
        pronunciationScore: 0,
        accuracyScore: 0,
        fluencyScore: 0,
        completenessScore: 0,
        words: [],
        recognitionStatus: azureData.RecognitionStatus,
        transcript: '',
        message: azureData.RecognitionStatus === 'NoMatch'
          ? 'Não consegui entender o que você falou. Tente de novo mais perto do microfone.'
          : `Falha no reconhecimento: ${azureData.RecognitionStatus}`
      });
    }

    const best = (azureData.NBest && azureData.NBest[0]) || {};

    // ─── CORREÇÃO PRINCIPAL ───
    // A Azure retorna os scores DIRETAMENTE no nível superior do NBest[0]
    // (não dentro de um objeto PronunciationAssessment aninhado).
    // Mas pra robustez, tentamos ambos os formatos.
    const paNested = best.PronunciationAssessment || best.pronunciationAssessment || {};

    const pronScore = best.PronScore || paNested.PronScore || paNested.pronScore || 0;
    const accuracyScore = best.AccuracyScore || paNested.AccuracyScore || paNested.accuracyScore || 0;
    const fluencyScore = best.FluencyScore || paNested.FluencyScore || paNested.fluencyScore || 0;
    const completenessScore = best.CompletenessScore || paNested.CompletenessScore || paNested.completenessScore || 0;

    // Palavras: também tentamos ambos os formatos
    const words = (best.Words || best.words || []).map(w => {
      const wpaNested = w.PronunciationAssessment || w.pronunciationAssessment || {};
      return {
        word: w.Word || w.word || '',
        accuracyScore: w.AccuracyScore || wpaNested.AccuracyScore || wpaNested.accuracyScore || 0,
        errorType: w.ErrorType || wpaNested.ErrorType || wpaNested.errorType || 'None'
      };
    });

    return res.status(200).json({
      pronunciationScore: pronScore,
      accuracyScore: accuracyScore,
      fluencyScore: fluencyScore,
      completenessScore: completenessScore,
      transcript: best.Display || azureData.DisplayText || '',
      words: words
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      detail: err.message
    });
  }
}
