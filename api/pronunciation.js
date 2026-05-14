// api/pronunciation.js
//
// Backend Vercel — Hat Trick Challenge · Gol 02 (v2)
// Recebe áudio do navegador em base64, envia pra Azure Speech Pronunciation Assessment,
// e devolve nota de 0-100 + score palavra por palavra.
//
// Variáveis de ambiente necessárias na Vercel:
//   AZURE_KEY     → sua chave do Speech Service
//   AZURE_REGION  → ex: eastus
//
// VERSÃO 2 — inclui:
//   - format=detailed (obrigatório pra Pronunciation Assessment)
//   - Accept header correto
//   - Tratamento de variações camelCase/PascalCase na resposta Azure
//   - Campo _debug na resposta pra ajudar a diagnosticar problemas

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
    let contentType;
    if (mimeType && mimeType.includes('webm')) {
      contentType = 'audio/webm; codecs=opus';
    } else if (mimeType && mimeType.includes('ogg')) {
      contentType = 'audio/ogg; codecs=opus';
    } else if (mimeType && mimeType.includes('mp4')) {
      contentType = 'audio/mp4';
    } else {
      contentType = 'audio/webm; codecs=opus';
    }

    // ─── URL da Azure ───
    const azureUrl = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

    console.log('Calling Azure:', azureUrl);
    console.log('Content-Type:', contentType);
    console.log('Audio buffer size:', audioBuffer.length, 'bytes');
    console.log('Reference text:', referenceText);

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
    console.log('Azure raw response keys:', Object.keys(azureData));
    if (azureData.NBest && azureData.NBest[0]) {
      console.log('NBest[0] keys:', Object.keys(azureData.NBest[0]));
      console.log('NBest[0] full:', JSON.stringify(azureData.NBest[0]).slice(0, 800));
    }

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

    // Tenta achar pronunciation assessment em vários formatos possíveis
    const pa = best.PronunciationAssessment
            || best.pronunciationAssessment
            || {};

    const words = (best.Words || best.words || []).map(w => {
      const wpa = w.PronunciationAssessment || w.pronunciationAssessment || {};
      return {
        word: w.Word || w.word || '',
        accuracyScore: wpa.AccuracyScore || wpa.accuracyScore || 0,
        errorType: wpa.ErrorType || wpa.errorType || 'None'
      };
    });

    return res.status(200).json({
      pronunciationScore: pa.PronScore || pa.pronScore || 0,
      accuracyScore: pa.AccuracyScore || pa.accuracyScore || 0,
      fluencyScore: pa.FluencyScore || pa.fluencyScore || 0,
      completenessScore: pa.CompletenessScore || pa.completenessScore || 0,
      transcript: best.Display || azureData.DisplayText || '',
      words: words,
      _debug: {
        recognitionStatus: azureData.RecognitionStatus,
        hadPronAssessment: Object.keys(pa).length > 0,
        nbestKeys: Object.keys(best),
        firstWordKeys: best.Words && best.Words[0] ? Object.keys(best.Words[0]) : [],
        paKeys: Object.keys(pa)
      }
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      detail: err.message
    });
  }
}
