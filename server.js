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
    console.log('data '+JSON.stringify(data));
    const transcript = data.channel?.alternatives[0]?.transcript;
    console.log('transcript '+JSON.stringify(transcript));
    if (transcript && !data.is_final) {
      clientSocket.send(JSON.stringify({ type: 'partial', text: transcript }));
    }

    if (transcript && data.is_final) {
      clientSocket.send(JSON.stringify({ type: 'final', text: transcript }));
    }
  });

  clientSocket.on('message', (msg) => {
    // Check if it's a Buffer or a string
    if (Buffer.isBuffer(msg)) {
      // ✅ Audio chunk: send directly to Deepgram
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.send(msg);
      }
    } else {
      // 🟡 Check for JSON 'end' signal (optional)
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'end') {
          dgSocket.close();
        }
      } catch (e) {
        console.warn('⚠️ Invalid non-binary message received:', msg.toString());
      }
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
