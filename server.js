const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();
const server = http.createServer();
const wss = new WebSocket.Server({ server });


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
          setTimeout(() => {
            console.log('🔚 Final full transcript:', fullTranscript);
          }, 1000);
          return;
        }
      } catch (jsonErr) {
        
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

