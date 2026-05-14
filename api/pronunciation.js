// api/pronunciation.js
//
// Backend Vercel — Hat Trick Challenge · Gol 02
// Recebe áudio do navegador em base64, envia pra Azure Speech Pronunciation Assessment,
// e devolve nota de 0-100 + score palavra por palavra.
//
// Variáveis de ambiente necessárias na Vercel:
//   AZURE_KEY     → sua chave do Speech Service
//   AZURE_REGION  → ex: eastus
//
// IMPORTANTE: Azure Pronunciation Assessment aceita áudio em formatos limitados.
// Recomendado: WAV (PCM 16-bit, 16 kHz, mono). Como o navegador grava em WebM/Opus,
// usamos o parâmetro "format=detailed" da API REST de short audio que aceita
// múltiplos formatos via Content-Type.
//
// Doc de referência:
// https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  // CORS — libera chamadas do HTML do quiz hospedado em qualquer domínio
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

    // Decodifica o áudio base64 pra Buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Monta o cabeçalho de Pronunciation Assessment (JSON serializado em base64)
    const pronunciationConfig = {
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',
      Granularity: 'Word',
      Dimension: 'Comprehensive',
      EnableMiscue: false
    };
    const pronAssessmentHeader = Buffer.from(JSON.stringify(pronunciationConfig)).toString('base64');

    // Define Content-Type baseado no mimeType recebido
    let contentType;
    if (mimeType && mimeType.includes('webm')) {
      contentType = 'audio/webm; codecs=opus';
    } else if (mimeType && mimeType.includes('ogg')) {
      contentType = 'audio/ogg; codecs=opus';
    } else if (mimeType && mimeType.includes('mp4')) {
      contentType = 'audio/mp4';
    } else {
      contentType = 'audio/webm; codecs=opus'; // default
    }

    // URL da Azure Speech REST API (short audio + pronunciation assessment)
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
      console.error('Azure error:', azureResponse.status, errText);
      return res.status(502).json({
        error: 'Azure Speech API error',
        status: azureResponse.status,
        detail: errText
      });
    }

    const azureData = await azureResponse.json();

    // Resposta esperada da Azure:
    // {
    //   RecognitionStatus: "Success",
    //   DisplayText: "the goalkeeper made a brilliant save",
    //   NBest: [{
    //     Confidence: 0.9,
    //     Lexical: "...",
    //     ITN: "...",
    //     MaskedITN: "...",
    //     Display: "...",
    //     PronunciationAssessment: {
    //       AccuracyScore: 92.5,
    //       FluencyScore: 95,
    //       CompletenessScore: 100,
    //       PronScore: 94
    //     },
    //     Words: [
    //       { Word: "the", PronunciationAssessment: { AccuracyScore: 90, ErrorType: "None" }, Offset: ..., Duration: ... },
    //       ...
    //     ]
    //   }]
    // }

    if (azureData.RecognitionStatus !== 'Success') {
      return res.status(200).json({
        pronunciationScore: 0,
        accuracyScore: 0,
        fluencyScore: 0,
        completenessScore: 0,
        words: [],
        recognitionStatus: azureData.RecognitionStatus,
        message: azureData.RecognitionStatus === 'NoMatch'
          ? 'Não consegui entender o que você falou. Tente de novo mais perto do microfone.'
          : 'Falha no reconhecimento de voz.'
      });
    }

    const best = (azureData.NBest && azureData.NBest[0]) || {};
    const pa = best.PronunciationAssessment || {};
    const words = (best.Words || []).map(w => ({
      word: w.Word,
      accuracyScore: (w.PronunciationAssessment && w.PronunciationAssessment.AccuracyScore) || 0,
      errorType: (w.PronunciationAssessment && w.PronunciationAssessment.ErrorType) || 'None'
    }));

    return res.status(200).json({
      pronunciationScore: pa.PronScore || 0,
      accuracyScore: pa.AccuracyScore || 0,
      fluencyScore: pa.FluencyScore || 0,
      completenessScore: pa.CompletenessScore || 0,
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
