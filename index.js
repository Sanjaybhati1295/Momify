const WebSocket = require('ws');
const http = require('http');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const fs = require('fs');
const { exec } = require('child_process');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
    console.log('Client connected');

    let audioBuffer = [];

    ws.on('message', function incoming(message) {
        const data = JSON.parse(message);
        if (data.type === 'audio') {
            const buffer = Buffer.from(data.data, 'base64');
            audioBuffer.push(buffer);
        }
        if (data.type === 'end') {
            const output = './output.wav';
            fs.writeFileSync(output, Buffer.concat(audioBuffer));

            console.log('Audio saved. Running transcription...');

            // Call whisper or vosk here (shell-based or local)
            exec(`whisper ${output} --language English --output_format txt`, (err, stdout, stderr) => {
                if (err) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Transcription failed' }));
                    return;
                }
                const text = fs.readFileSync('./output.txt', 'utf8');

                // Basic summarization using Hugging Face API (or local model)
                fetch('https://api-inference.huggingface.co/models/facebook/bart-large-cnn', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer YOUR_HF_API_KEY`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ inputs: text })
                })
                    .then(res => res.json())
                    .then(data => {
                        ws.send(JSON.stringify({
                            type: 'summary',
                            transcription: text,
                            summary: data[0]?.summary_text || 'Summary unavailable'
                        }));
                    });
            });
        }
    });
});

server.listen(3000, () => {
    console.log('Server started on port 3000');
});
