import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { env, pipeline as hfPipeline } from '@xenova/transformers';
dotenv.config();

// Set token from environment variable
env.allowRemoteModels = true;
env.HF_ACCESS_TOKEN = process.env.HF_API_TOKEN;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  } 
  // Static file handling
  const filePath = path.join(
    __dirname,
    'public',
    req.url === '/' ? 'index.html' : req.url
  );

  try {
    const data = fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const contentTypeMap = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css'
    }[ext] || 'text/plain';

    res.writeHead(200, {
      'Content-Type': contentTypeMap[ext] || 'text/plain',
    });
    res.end(data);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    }
});

const wss = new WebSocketServer({ server });
wss.on('connection', function connection(clientSocket) {
  console.log('🎙 Client connected');
  let fullTranscript = '';  
  // Connect to Deepgram
  const dgSocket = new WebSocket(
    'wss://api.deepgram.com/v1/listen',[],{headers: {
        Authorization: 'Token e0c027bfdf8c501bdafb7b30ec02046db652a315',
     }}
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
      try {
        const parsed = JSON.parse(messageString);
        if (parsed.type === 'end') {
          console.log('📴 End message received. Closing Deepgram socket...');
          dgSocket.close();
          setTimeout(async () => {
            console.log('🔚 Final full transcript:', fullTranscript);
            try {
              const summary = await generateSummary(fullTranscript);
              console.log('📝 MoM Summary:', summary);
              clientSocket.send(JSON.stringify({ type: 'summary', text: summary }));
            } catch (err) {
              console.error('❌ Summary generation error:', err);
              clientSocket.send(JSON.stringify({ type: 'summary', text: 'Failed to generate summary.' }));
            }
          }, 1000);
          return;
        }
      } catch (jsonErr) {
        
      }
      if (Buffer.isBuffer(msg)) {
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


const summarizer = await hfPipeline('summarization', 'Xenova/distilbart-cnn-12-6'); // or any other MoM-focused model
async function generateSummary(transcript) {
  const prompt = `
  Transcript:
  ${transcript}

  Write a meeting summary covering:
  - Key discussion points
  - Decisions taken
  - Action items with ownership
  `.trim();
  const output = await summarizer(prompt, {
    max_new_tokens: 200, // increase to allow better detail
    temperature: 0.7,     // optional: helps with variation
  });
  return output[0].summary_text;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

