// Define the AudioWorkletProcessor class
class ChunkProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.chunks = [];
        this.port.onmessage = (event) => {
            // When 'get-chunks' is received, call sendChunks()
            if (event.data === 'get-chunks') {
                this.sendChunks();
            }
        };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input) {
            // Flatten the input to a single channel if necessary
            const channelData = input[0];
            //console.log("Captured audio chunk:", channelData);
            // Store the audio chunk
            this.chunks.push(channelData.slice()); // Make a copy of the audio data
        }
        // Keep the processor running
        return true;
    }

    sendChunks() {
        // Ensure chunks is defined and populated
        if (this.chunks.length > 0) {
            console.warn("YAYYYYYY");
            this.port.postMessage(this.chunks);
        } else {
            console.warn("Chunks are empty or not populated.");
        }
    }
}

// Register the AudioWorkletProcessor
registerProcessor('chunk-processor', ChunkProcessor);