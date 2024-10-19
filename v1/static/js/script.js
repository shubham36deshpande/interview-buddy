document.addEventListener('DOMContentLoaded', function () {
    const startButton = document.getElementById('start-listening');
    const stopButton = document.getElementById('stop-listening');
    const fetchButton = document.getElementById('fetch-answer');
    const skipButton = document.getElementById('skip');
    const outputDiv = document.getElementById('speech-output');
    const responseDiv = document.getElementById('response-output');

    let recognition;
    let listening = false;
    let finalTranscript = '';

    startButton.addEventListener('click', () => {
        if (!listening) {
            recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                outputDiv.textContent = `You said: "${finalTranscript}${interimTranscript}"`;
            };

            recognition.start();
            listening = true;
            startButton.style.display = 'none';
            stopButton.style.display = 'inline';
            outputDiv.textContent = "Listening...";
        }
    });

    stopButton.addEventListener('click', () => {
        if (recognition && listening) {
            recognition.stop();
            listening = false;
            stopButton.style.display = 'none';
            startButton.style.display = 'inline';
            outputDiv.textContent = `You said: "${finalTranscript}"`;
            fetchButton.style.display = 'inline';
            skipButton.style.display = 'inline';
        }
    });

    fetchButton.addEventListener('click', () => {
        const question = finalTranscript;
        fetch('/ask_gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: question })
        })
            .then(response => response.json())
            .then(data => {
                if (data.answer) {
                    responseDiv.innerHTML = formatResponse(data.answer);
                } else {
                    responseDiv.textContent = "Error: " + (data.error || 'Unknown error');
                }
                fetchButton.style.display = 'none';
                skipButton.style.display = 'none';
                finalTranscript = ''; // Clear the final transcript after fetching answer
            })
            .catch(error => {
                responseDiv.textContent = "Error: " + error;
            });
    });

    skipButton.addEventListener('click', () => {
        fetchButton.style.display = 'none';
        skipButton.style.display = 'none';
        finalTranscript = ''; // Clear the final transcript if skipped
    });

    function formatResponse(response) {
        if (!response) return '';
    
        // First, replace code blocks to avoid interference with other formatting
        response = response.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
    
        // Then, handle bold text
        response = response.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
        // Split the response into paragraphs and list items
        const parts = response.split('\n');
        let formattedResponse = '';
    
        let inList = false;
        for (const part of parts) {
            if (part.trim().startsWith('* ')) { // List item
                const listItem = part.trim().substring(2);
                if (!inList) {
                    formattedResponse += '<ul>';
                    inList = true;
                }
                formattedResponse += `<li>${listItem}</li>`;
            } else if (part.trim() !== '') { // Paragraph (non-empty line)
                if (inList) {
                    formattedResponse += '</ul>';
                    inList = false;
                }
                formattedResponse += `<p>${part.trim()}</p>`;
            }
        }
        if (inList) { // Close the list if it's still open
            formattedResponse += '</ul>';
        }
    
        return formattedResponse;
    }
});