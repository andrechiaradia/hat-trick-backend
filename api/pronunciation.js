/**
 * ═══════════════════════════════════════════════════════════════
 * HAT TRICK CHALLENGE — BACKEND DE PRONÚNCIA
 * ═══════════════════════════════════════════════════════════════
 *
 * Este arquivo recebe áudio do aluno, envia pra Azure Pronunciation
 * Assessment, e devolve o score de pronúncia.
 *
 * Não precisa editar nada aqui! A chave e a região da Azure são
 * configuradas como "Environment Variables" na Vercel (veja o
 * passo a passo no arquivo COMO_CONFIGURAR_GOL2.md).
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // áudios podem ficar até ~5MB
    },
  },
};

export default async function handler(req, res) {
  // CORS — permite que o HTML do quiz, hospedado em qualquer lugar, fale com este backend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // pré-requisição OPTIONS (browser pergunta antes de fazer o POST real)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const AZURE_KEY = process.env.AZURE_KEY;
    const AZURE_REGION = process.env.AZURE_REGION;

    if (!AZURE_KEY || !AZURE_REGION) {
      return res.status(500).json({
        error: 'Backend não configurado: faltam AZURE_KEY ou AZURE_REGION',
      });
    }

    const { audioBase64, referenceText } = req.body;

    if (!audioBase64 || !referenceText) {
      return res.status(400).json({
        error: 'Faltam dados: precisa enviar audioBase64 e referenceText',
      });
    }

    // converte base64 → buffer binário (Azure quer áudio binário)
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // monta o JSON de configuração da avaliação de pronúncia
    // ver docs: https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment
    const pronConfig = {
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',  // score 0-100
      Granularity: 'Word',           // avaliar palavra por palavra
      Dimension: 'Comprehensive',    // accuracy + fluency + completeness + pronunciation
      EnableMiscue: 'True',          // detecta palavras puladas / extras
    };

    // encode em base64 (jeito que a Azure quer)
    const pronConfigBase64 = Buffer.from(JSON.stringify(pronConfig)).toString('base64');

    // monta URL da Azure
    const azureUrl = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

    // chama a Azure
    const azureResponse = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Pronunciation-Assessment': pronConfigBase64,
        'Accept': 'application/json',
      },
      body: audioBuffer,
    });

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('Erro da Azure:', azureResponse.status, errorText);
      return res.status(500).json({
        error: `Azure retornou erro ${azureResponse.status}`,
        detail: errorText,
      });
    }

    const azureData = await azureResponse.json();

    // a Azure às vezes não reconhece nada
    if (azureData.RecognitionStatus !== 'Success' || !azureData.NBest || azureData.NBest.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'Não conseguimos entender o que você falou. Tente de novo, mais alto e claro.',
        rawAzure: azureData,
      });
    }

    // pega a primeira hipótese (mais provável)
    const best = azureData.NBest[0];
    const pronAssessment = best.PronunciationAssessment || {};

    // extrai score por palavra
    const words = (best.Words || []).map(w => ({
      word: w.Word,
      accuracyScore: Math.round(w.PronunciationAssessment?.AccuracyScore || 0),
      errorType: w.PronunciationAssessment?.ErrorType || 'None', // None, Mispronunciation, Omission, Insertion
    }));

    // monta a resposta limpa pro frontend
    return res.status(200).json({
      success: true,
      transcription: best.Display || best.Lexical || '',
      overallScore: Math.round(pronAssessment.PronScore || 0),
      accuracyScore: Math.round(pronAssessment.AccuracyScore || 0),
      fluencyScore: Math.round(pronAssessment.FluencyScore || 0),
      completenessScore: Math.round(pronAssessment.CompletenessScore || 0),
      words: words,
    });

  } catch (err) {
    console.error('Erro no backend:', err);
    return res.status(500).json({
      error: 'Erro interno no servidor',
      detail: err.message,
    });
  }
}
