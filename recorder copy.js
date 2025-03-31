let stream;
let mediaRecorder;
let audioChunks = [];
let matchFound = false;

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
    audioChunks = [];
    try {
        document.getElementById("buffer").style.display = "block";
        document.getElementById("audio-status").innerText = "Loading...";
        document.getElementById("song-info").style.display = "none";
        document.getElementById("no-matches").style.display = "none";
        document.getElementById("get-id").style.display = "none";
        // Request microphone access
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Set up the media recorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();

        // Collect recorded audio data
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
            console.log(audioChunks)
        };

        matchFound = false;
        let i = 0;
        const maxLength = 20;
        const clipLength = 5; // 5 second clips each time

        const intervalId = setInterval(() => {
            if (matchFound) {
                clearInterval(intervalId); // Stop the interval if matchFound is true
                return; // Exit the interval
            }
        
            document.getElementById("audio-status").innerText = `Listening for ${i + 1} seconds`;
        
            if (i !== 0 && i % clipLength === 0) {
                console.log('STOPPING RECORDER IN INTERVAL ', i);
                console.log(audioChunks);
                mediaRecorder.stop();
                if (i < maxLength) {
                    mediaRecorder.start();
                } else {
                    clearInterval(intervalId); // Stop the interval when maxLength is reached
                    noMatches()
                }
            }

            i++; // Increment the counter

        }, 1000); // Run every second
        
        mediaRecorder.onstop = () => {
            if (!matchFound) {
                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                sendRecording(audioBlob); // Send to FastAPI
            }
        };

    } catch (error) {
        console.error("Error accessing microphone:", error);
    }
}

async function sendRecording(audioBlob) {
    const formData = new FormData();
    formData.append("file", audioBlob, 'rec.webm'); // Append the file

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
    stream.getTracks().forEach(track => track.stop()); // Stop mic
    document.getElementById("buffer").style.display = "none";
    document.getElementById("no-matches").style.display = "block";
    document.getElementById("get-id").style.display = "block";
}

checkHealth()
document.getElementById("recordBtn").addEventListener("click", startRecording);