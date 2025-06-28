const WebSocket = require('ws');
const http = require('http');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Deepgram WebSocket Transcriber');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(clientSocket) {
  console.log('🎙 Client connected');

  // Connect to Deepgram real-time API
  const dgSocket = new WebSocket(`wss://api.deepgram.com/v1/listen`, [], {
    headers: {
      Authorization: `Token e0c027bfdf8c501bdafb7b30ec02046db652a315`,
    }
  });

  dgSocket.on('open', () => {
    console.log('🔗 Connected to Deepgram');
  });

  dgSocket.on('message', (message) => {
    const data = JSON.parse(message);
    const transcript = data.channel?.alternatives[0]?.transcript;

    if (transcript && !data.is_final) {
      clientSocket.send(JSON.stringify({ type: 'partial', text: transcript }));
    }

    if (transcript && data.is_final) {
      clientSocket.send(JSON.stringify({ type: 'final', text: transcript }));
    }
  });

  clientSocket.on('message', (msg) => {
    const parsed = JSON.parse(msg);

    if (parsed.type === 'audio') {
      const audioBuffer = Buffer.from(parsed.data, 'base64');
      dgSocket.send(audioBuffer);
    }

    if (parsed.type === 'end') {
      dgSocket.close();
    }
  });

  clientSocket.on('close', () => {
    dgSocket.close();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
});
