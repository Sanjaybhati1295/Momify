const WebSocket = require('ws');
const http = require('http');
const { OpenAI } = require('openai');  // npm install openai
const openai = new OpenAI({ apiKey: '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' });
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
  const prompt = `Summarize this meeting in clear bullet points:\n\n${transcript}`;
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', // or 'gpt-4'
    messages: [
      { role: 'system', content: 'You are a helpful meeting summarizer.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
  });

  return completion.choices[0].message.content.trim();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
