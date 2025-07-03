let mediaRecorder;
let socket;
let audioChunks = [];

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

const summaryEl = document.getElementById('summary');

startBtn.onclick = async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  const transcriptionEl = document.getElementById('transcription');
  socket = new WebSocket("wss://momify.onrender.com");

  socket.onopen = () => {
    console.log("✅ WebSocket connected");
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('data '+JSON.stringify(data));
    if (data.type === 'final') {
      transcriptionEl.innerText += ' '+data.text || 'No transcript';
    }
    if (data.type === 'summary') {
      console.log('📝 MoM Summary from Server:', data.text);
      summaryEl.innerText = data.text || 'No summary';
      socket.close(); // only close after summary received
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

  mediaRecorder.ondataavailable = async (event) => {
    console.log('🎤 Blob size:', event.data.size);
    if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
      const buffer = await event.data.arrayBuffer();
      socket.send(buffer);
    }
  };

  mediaRecorder.start(1000); // Send every second
};

stopBtn.onclick = () => {
  stopBtn.disabled = true;
  startBtn.disabled = false;
  mediaRecorder.stop();

  socket.send(JSON.stringify({ type: 'end' }));
  console.log("🔌 Closing client WebSocket");
};
