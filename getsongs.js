async function loadURLs() {
    try {
        const response = await fetch('songs.txt'); // Fetch the text file
        const text = await response.text(); // Read the file as text
        const lines = text.split(/\r?\n/); // Split into lines
        
        const songList = document.getElementById("songList");

        lines.forEach((line, index) => {
            if (line.trim()) { // Ignore empty lines
                const li = document.createElement("li");
                const a = document.createElement("a");
                a.href = line.trim();
                a.textContent = line.trim();
                a.target = "_blank"; // Open links in a new tab
                li.appendChild(a);
                songList.appendChild(li);
            }
        });
    } catch (error) {
        console.error("Error loading the URLs:", error);
    }
}

loadURLs();