let stream;
// let mediaRecorder;
// let audioChunks = [];
let matchFound = false;
const sampleRate = 44100;

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
    document.getElementById("buffer").style.display = "block";
    document.getElementById("audio-status").innerText = "Loading...";
    document.getElementById("song-info").style.display = "none";
    document.getElementById("no-matches").style.display = "none";
    document.getElementById("get-id").style.display = "none";

    const audioContext = new AudioContext({
        sampleRate: sampleRate
    });

    await audioContext.audioWorklet.addModule("chunk-processor.js");

    // Request microphone access
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const source = audioContext.createMediaStreamSource(stream);
    const processor = new AudioWorkletNode(audioContext, "chunk-processor");

    source.connect(processor);
    processor.connect(audioContext.destination);

    matchFound = false;
    let clipNum = 1;
    let i = 0;
    const maxLength = 20;
    const clipLength = 5; // 5 second clips each time

    const intervalId = setInterval(() => {
        if (matchFound) {
            console.log('Match found');
            clearInterval(intervalId); // Stop the interval if matchFound is true
            audioContext.close()
            return; // Exit the interval
        }
    
        document.getElementById("audio-status").innerText = `Listening for ${i + 1} seconds`;
    
        if (i !== 0 && i % clipLength === 0) {
            console.log('STOPPING RECORDER IN INTERVAL ', i);
            processor.port.postMessage('get-chunks');
            if (i < maxLength) {
                console.log("test")
            } else {
                clearInterval(intervalId); // Stop the interval when maxLength is reached
                audioContext.close()
                noMatches()
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
    // console.log("IN SEND RECORDING")
    // console.log(audioBlob)
    // const blobUrl = URL.createObjectURL(audioBlob);

    // // Create a download link
    // const a = document.createElement("a");
    // a.href = blobUrl;
    // a.download = `recording_${Date.now()}.wav`; // Unique filename
    // document.body.appendChild(a);
    // a.click();
    // document.body.removeChild(a);

    // // Revoke the URL after a delay to free memory
    // setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

    // console.log("Recording saved locally.");

    const formData = new FormData();
    formData.append("file", audioBlob, 'rec.wav'); // Append the file
    formData.append("clipNum", clipNum)

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
    }
}

// Function to handle the server response
function handleServerResponse(data) {
    // Example: Display the result URL
    if (Object.keys(data).length === 0) {
        console.log("No matches received from server:", data);
    } else {
        console.log("Received data from server:", data)
        matchFound = true;
        stream.getTracks().forEach(track => track.stop()); // Stop mic
        document.getElementById("artwork").src = 'https://i1.sndcdn.com/artworks-' + data.artwork_path + '-t500x500.jpg';
        document.getElementById("songURL").href = 'https://soundcloud.com/' + data.song_path;
        document.getElementById("title").innerText = data.title;
        document.getElementById("username").innerText = data.username;
        document.getElementById("confidence").innerText = data.confidence;
        document.getElementById("buffer").style.display = "none";
        document.getElementById("song-info").style.display = "block";
        document.getElementById("get-id").style.display = "block";
    }
}

function noMatches() {
    console.log('No matches found');
    stream.getTracks().forEach(track => track.stop()); // Stop mic
    document.getElementById("buffer").style.display = "none";
    document.getElementById("no-matches").style.display = "block";
    document.getElementById("get-id").style.display = "block";
}

checkHealth()
document.getElementById("recordBtn").addEventListener("click", startRecording);