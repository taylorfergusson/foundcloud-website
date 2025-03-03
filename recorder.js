import { MediaRecorder, register } from 'extendable-media-recorder';
import { connect } from 'extendable-media-recorder-wav-encoder';

let mediaRecorder;
let audioChunks = [];

export async function startRecording() {
    try {
        document.getElementById("buffer").style.display = "block";
        document.getElementById("audio-status").innerText = "Loading...";
        document.getElementById("song-info").style.display = "none";
        document.getElementById("get-id").style.display = "none";

        // Register the WAV encoder
        await register(await connect());

        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Use the extended MediaRecorder with WAV format
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/wav' });

        // Collect recorded audio data
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.start();

        for (let i = 1; i <= 11; i++) {
            setTimeout(() => {
                document.getElementById("audio-status").innerText = `Listening for ${i} seconds`;
        
                // Stop recording when reaching 10 seconds
                if (i === 11) {
                    mediaRecorder.stop();
                }
            }, i * 1000);
        }

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop()); // Stop mic
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            audioChunks = []; // Clear chunks
            sendRecording(audioBlob); // Send to FastAPI
        };

    } catch (error) {
        console.error("Error accessing microphone:", error);
    }
}

async function sendRecording(audioBlob) {
    document.getElementById("audio-status").innerText = "Finding match...";
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav"); // Append the file

    try {
        const response = await fetch("https://api.foundcloud.taylorfergusson.com/upload/", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Upload failed");

        const data = await response.json(); // Get response from FastAPI
        console.log("Server Response:", data);
        handleServerResponse(data);
    } catch (error) {
        console.error("Error uploading file:", error);
    }
}

// Function to handle the server response
function handleServerResponse(data) {
    // Example: Display the result URL
    if (data) {
        document.getElementById("artwork").src = data.artworkURL;
        document.getElementById("songURL").href = data.songURL;
        document.getElementById("title").innerText = data.title;
        document.getElementById("username").innerText = data.username;
        document.getElementById("confidence").innerText = data.confidence;
        document.getElementById("buffer").style.display = "none";
        document.getElementById("song-info").style.display = "block";
        document.getElementById("get-id").style.display = "block";

    } else {
        console.log("Unexpected response:", data);
    }
}