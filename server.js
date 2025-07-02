const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(clientSocket) {
  console.log('🎙 Client connected');

  // Connect to Deepgram
  const dgSocket = new WebSocket(
    'wss://api.deepgram.com/v1/listen?encoding=webm&sample_rate=48000&punctuate=true&language=en',
    {
      headers: {
        Authorization: `Token e0c027bfdf8c501bdafb7b30ec02046db652a315`
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
        }
      } catch (e) {
        console.warn('⚠️ Non-binary message:', msg.toString());
      }
    }
  });

  clientSocket.on('close', () => {
    console.log('socket closed');
    dgSocket.close();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
