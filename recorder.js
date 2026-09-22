let stream;
let audioContext;
let matchFound = false;
let clipNum = 1;
const sampleRate = 44100;

let analyser, eqRafId, eqRunning = false;
let recordingIntervalId;
let responsesReceived = 0;
const TOTAL_CLIPS = 4; // maxLength / clipLength inside startRecording
const eqBars = document.querySelectorAll('#equalizer span');

async function checkHealth() {
    try {
        const response = await fetch("https://api.foundcloud.taylorfergusson.com/health/", {
            method: "GET"
        });
        if (!response.ok) throw new Error("Server down");
        document.getElementById("get-id").style.display = "block";
    } catch (error) {
        console.error("Server down");
        document.getElementById("server-down").style.display = "block";
    }
}

async function startRecording() {
    document.getElementById("listening").style.display = "block";
    document.getElementById("audio-status").innerText = "Loading";
    document.getElementById("song-info").style.display = "none";
    document.getElementById("no-matches").style.display = "none";
    document.getElementById("get-id").style.display = "none";

    if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
    }
    
    audioContext = new AudioContext({
        sampleRate: sampleRate
    });

    await audioContext.audioWorklet.addModule("chunk-processor.js");

    // Request microphone access
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const source = audioContext.createMediaStreamSource(stream);
    const processor = new AudioWorkletNode(audioContext, "chunk-processor");

    source.connect(processor);
    processor.connect(audioContext.destination);

    startEqualizer(source, audioContext);

    matchFound = false;
    clipNum = 1;
    responsesRecived = 0;

    let i = 0;
    const maxLength = 20;
    const clipLength = 5; // 5 second clips each time

    recordingIntervalId = setInterval(() => {
        if (matchFound) {
            console.log('Match found');
            clearInterval(recordingIntervalId); // Stop the interval if matchFound is true
            if (audioContext.state !== 'closed') {
                audioContext.close();
            }
            return; // Exit the interval
        }
    
        document.getElementById("audio-status").innerText = `Listening for ${i + 1} seconds`;
    
        if (i !== 0 && i % clipLength === 0) {
            console.log('STOPPING RECORDER IN INTERVAL ', i);
            processor.port.postMessage('get-chunks');
            if (i < maxLength) {
                console.log("test")
            } else {
                clearInterval(recordingIntervalId); // Stop the interval when maxLength is reached
            }
        }

        i++; // Increment the counter

    }, 1000); // Run every second

    // Handle the chunks sent from the AudioWorkletProcessor
    processor.port.onmessage = async (event) => {
        const chunks = event.data;
        console.log('Received chunks:', chunks.length);
        const audioBlob = createWavBlob(chunks)

        if (audioBlob) {
            sendRecording(audioBlob, clipNum);
            clipNum++;
        } else {
            console.error("Failed to create a valid audio blob.");
        }
    };
}

function createWavBlob(chunks) {
    // Flatten all chunks into one array
    const pcmData = flattenChunks(chunks);

    // Convert the PCM data to 16-bit signed integers
    const pcm16Bit = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
        pcm16Bit[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32767)); // Normalize to 16-bit PCM
    }

    // WAV header construction
    const buffer = new ArrayBuffer(44 + pcm16Bit.length * 2); // 44-byte header + PCM data
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcm16Bit.length * 2, true); // File size - 8 bytes
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // Audio format (1 = PCM)
    view.setUint16(22, 1, true); // Number of channels (1 = Mono)
    view.setUint32(24, 44100, true); // Sample rate (44.1 kHz)
    view.setUint32(28, 44100 * 2, true); // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true); // Block align (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // Bits per sample (16)

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcm16Bit.length * 2, true); // Data size (num samples * bytes per sample)

    // Write PCM data
    for (let i = 0; i < pcm16Bit.length; i++) {
        view.setInt16(44 + i * 2, pcm16Bit[i], true); // Write each sample as 16-bit PCM
    }

    const audioBlob = new Blob([buffer], { type: 'audio/wav' });

    return audioBlob;
}

function flattenChunks(chunks) {
    // Flatten the array of arrays into a single array of PCM samples
    let flattened = [];
    for (let i = 0; i < chunks.length; i++) {
        flattened = flattened.concat(Array.from(chunks[i]));
    }
    return flattened;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

async function sendRecording(audioBlob, clipNum) {
    const formData = new FormData();
    formData.append("file", audioBlob, 'rec.wav'); // Append the file
    formData.append("clipNum", String(clipNum))

    try {
        const response = await fetch("https://api.foundcloud.taylorfergusson.com/upload/", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Upload failed");

        const data = await response.json(); // Get response from FastAPI
        handleServerResponse(data);
    } catch (error) {
        console.error("Error uploading file:", error);
        checkIfDone();
    }
}

// Function to handle the server response
function handleServerResponse(data) {
    if (Object.keys(data).length === 0) {
        console.log("No matches received from server:", data);
        checkIfDone();
    } else {
        console.log("Received data from server:", data)
        matchFound = true;
        clearInterval(recordingIntervalId);
        stream.getTracks().forEach(track => track.stop()); // Stop mic
        stopEqualizer();
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
        document.getElementById("artwork").src = 'https://i1.sndcdn.com/artworks-' + data.artwork_path + '-t500x500.jpg';
        document.getElementById("songURL").href = 'https://soundcloud.com/' + data.song_path;
        document.getElementById("title").innerText = data.title;
        document.getElementById("username").innerText = data.username;
        document.getElementById("confidence").innerText = data.confidence;
        document.getElementById("listening").style.display = "none";
        document.getElementById("song-info").style.display = "block";
        document.getElementById("get-id").style.display = "block";
    }
}

function checkIfDone() {
    responsesReceived++;
    if (!matchFound && responsesReceived >= TOTAL_CLIPS) {
        clearInterval(recordingIntervalId);
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
        noMatches();
    }
}

function noMatches() {
    console.log('No matches found -- Done');
    stream.getTracks().forEach(track => track.stop()); // Stop mic
    stopEqualizer();
    document.getElementById("listening").style.display = "none";
    document.getElementById("no-matches").style.display = "block";
    document.getElementById("get-id").style.display = "block";
}

function startEqualizer(sourceNode, ctx) {
  if (eqRunning) {
    stopEqualizer(); // cancel any previous loop before starting a new one
  }
  eqRunning = true;

  analyser = ctx.createAnalyser();
  analyser.fftSize = 32; // small = fewer, chunkier bands; matches 5 bars well
  sourceNode.connect(analyser);

  document.getElementById('equalizer').style.display = 'flex';
  const data = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    analyser.getByteFrequencyData(data);
    eqBars.forEach((bar, i) => {
      const value = data[i] || 0;
      const height = Math.max(10, (value / 255) * 60); // 10 = matches the CSS resting height
      bar.style.height = `${height}px`;
    });
    eqRafId = requestAnimationFrame(draw);
  }
  draw();
}

function stopEqualizer() {
  eqRunning = false;
  cancelAnimationFrame(eqRafId);
  document.getElementById('equalizer').style.display = 'none';
  eqBars.forEach(bar => (bar.style.height = '10px'));
}

// checkHealth()
document.getElementById("get-id").style.display = "block";
document.getElementById("recordBtn").addEventListener("click", startRecording);