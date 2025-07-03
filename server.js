const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();
const server = http.createServer();
const wss = new WebSocket.Server({ server });
const axios = require('axios');
import { pipeline } from '@xenova/transformers';
let summarizer;

export async function loadSummarizerModel() {
  console.log('⏳ Loading summarization model...');
  summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-12-6');
  console.log('✅ Summarization model loaded.');
}

(async () => {
await loadSummarizerModel(); 


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
      const data = JSON.parse(message);
      const transcript = data.channel?.alternatives?.[0]?.transcript;
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
    try {
      let messageString = msg;
  
      if (Buffer.isBuffer(msg)) {
        messageString = msg.toString('utf8'); // Convert buffer to string
      }
  
      console.log('message from client ::', messageString);
  
      try {
        const parsed = JSON.parse(messageString);
  
        // If it's a control message like end
        if (parsed.type === 'end') {
          console.log('📴 End message received. Closing Deepgram socket...');
          dgSocket.close();
  
          setTimeout(() => {
            console.log('🔚 Final full transcript:', fullTranscript);
            const summary = await generateSummary(fullTranscript);
            console.log('📝 Meeting Summary:', summary);
            clientSocket.send(JSON.stringify({ type: 'summary', text: summary }));
          }, 1000);
  
          return; // stop processing
        }
      } catch (jsonErr) {
        // Not JSON => treat as audio buffer
      }
  
      if (Buffer.isBuffer(msg)) {
        console.log('📦 Sending buffer to Deepgram:', msg.length);
        dgSocket.send(msg);
      }
  
    } catch (err) {
      console.error('❌ Error in clientSocket.on(message):', err);
    }
  });

  clientSocket.on('close', () => {
    console.log('socket closed');
    dgSocket.close();
  });
});

export async function generateSummary(text) {
  if (!summarizer) {
    throw new Error('Summarizer model not loaded.');
  }

  const result = await summarizer(text);
  return result[0].summary_text;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

})();
