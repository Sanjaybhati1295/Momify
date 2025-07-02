const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();
const axios = require('axios');
const { OpenAI } = require('openai');  // npm install openai
const openai = new OpenAI({ 
  apiKey: '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'
});
const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(clientSocket) {
  console.log('🎙 Client connected');
  let fullTranscript = '';  
  // Connect to Deepgram
  const dgSocket = new WebSocket(
    'wss://api.deepgram.com/v1/listen',
    [],
    {
      headers: {
        Authorization: 'Token e0c027bfdf8c501bdafb7b30ec02046db652a315',
      }
    }
  );

  dgSocket.on('open', () => {
    console.log('🔗 Connected to Deepgram');
  });

  dgSocket.on('error', (err) => {
    console.error('❌ Deepgram socket error:', err.message || err);
  });
  
  dgSocket.on('close', (code, reason) => {
    console.warn(`🔌 Deepgram connection closed: [${code}] ${reason}`);
  });

  dgSocket.on('message', (message) => {
    try {
      console.log('message in deepgram '+message);
      const data = JSON.parse(message);
      console.log('data in deepgram '+data);
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      console.log('transcript in deepgram '+transcript);
      if (transcript && transcript.length > 0) {
        if (data.is_final) {
          fullTranscript += transcript + ' ';
          console.log('✅ Final:', transcript);
          clientSocket.send(JSON.stringify({ type: 'final', text: transcript }));
        } else {
          console.log('⏳ Partial:', transcript);
          clientSocket.send(JSON.stringify({ type: 'partial', text: transcript }));
        }
      }
    } catch (err) {
      console.error('❌ Deepgram JSON error', err);
    }
  });

  clientSocket.on('message', (msg) => {
    console.log('message from client ::'+msg);
    if (Buffer.isBuffer(msg)) {
      console.log('📦 Sending buffer to Deepgram:', msg.length);
      dgSocket.send(msg);
    } else {
      console.log('Its not buffere in client side audio.');
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'end') {
          dgSocket.close();
          setTimeout(() => {
            console.log('🔚 Final full transcript:', fullTranscript);
            generateSummary(fullTranscript).then(summary => {
              console.log('📝 Meeting Summary:', summary);
              clientSocket.send(JSON.stringify({ type: 'summary', text: summary }));
            }).catch(err => {
              console.error('❌ Summary generation error:', err);
              clientSocket.send(JSON.stringify({ type: 'summary', text: 'Failed to generate summary' }));
            });
          }, 1000);
        }
      } catch (e) {
        console.warn('⚠️ Non-binary message:', msg.toString());
      }
    }
  });

  clientSocket.on('close', () => {
    console.log('socket closed');
    dgSocket.close();
    generateSummary(fullTranscript).then(summary => {
      console.log('📝 Meeting Summary:', summary);
      clientSocket.send(JSON.stringify({ type: 'summary', text: summary }));
    });
  });
});

async function generateSummary(transcript) {
  const prompt = `Summarize this meeting:\n\n${transcript}`;
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful summarizer.' },
        { role: 'user', content: prompt }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content.trim();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
