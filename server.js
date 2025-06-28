const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(clientSocket) {
  console.log('🎙 Client connected');

  // Connect to Deepgram
  const dgSocket = new WebSocket(
    'wss://api.deepgram.com/v1/listen?punctuate=true&language=en&encoding=opus&sample_rate=48000',
    [],
    {
      headers: {
        Authorization: `Token e0c027bfdf8c501bdafb7b30ec02046db652a315`
      }
    }
  );

  dgSocket.on('open', () => {
    console.log('🔗 Connected to Deepgram');
  });

  dgSocket.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (transcript && !data.is_final) {
        console.log('🟡 Partial:', transcript);
        clientSocket.send(JSON.stringify({ type: 'partial', text: transcript }));
      } else if (transcript && data.is_final) {
        console.log('✅ Final:', transcript);
        clientSocket.send(JSON.stringify({ type: 'final', text: transcript }));
      }
    } catch (err) {
      console.error('❌ Deepgram JSON error', err);
    }
  });

  clientSocket.on('message', (msg) => {
    if (Buffer.isBuffer(msg)) {
      console.log('📦 Sending buffer to Deepgram:', msg.length);
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.send(msg);
      }
    } else {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'end') {
          dgSocket.close();
        }
      } catch (e) {
        console.warn('⚠️ Non-binary message:', msg.toString());
      }
    }
  });

  clientSocket.on('close', () => {
    dgSocket.close();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
