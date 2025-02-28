let mediaRecorder;
let audioChunks = [];

async function startRecording() {
    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Set up the media recorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
        document.getElementById("recordBtn").disabled = true; // Disable button during recording

        // Collect recorded audio data
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        // Stop recording after 10 seconds
        setTimeout(() => {
            mediaRecorder.stop();
        }, 10000);

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            audioChunks = []; // Clear chunks
        
            sendRecording(audioBlob); // Send to FastAPI
        };

    } catch (error) {
        console.error("Error accessing microphone:", error);
    }
}

async function sendRecording(audioBlob) {
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
        console.log("RESPONSE:", data);
        document.getElementById("artwork").src = data.artworkURL;
        document.getElementById("songURL").href = data.songURL;
        document.getElementById("title").innerText = data.title;
        document.getElementById("username").innerText = data.username;
    } else {
        console.log("Unexpected response:", data);
    }
}