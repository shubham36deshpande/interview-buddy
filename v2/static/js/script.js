document.addEventListener('DOMContentLoaded', function () {
    const startButton = document.getElementById('start-listening');
    const stopButton = document.getElementById('stop-listening');
    const uploadForm = document.getElementById('upload-form');
    const outputDiv = document.getElementById('speech-output');
    const responseDiv = document.getElementById('response-output');

    let recognition;
    let listening = false;
    let finalTranscript = '';

    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(uploadForm);

            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                window.location.href = '/ask_question';
            })
            .catch(error => {
                alert('Error: ' + error);
            });
        });
    }

    if (startButton && stopButton) {
        startButton.addEventListener('click', () => {
            if (!listening) {
                try {
                    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                    recognition.continuous = true;
                    recognition.interimResults = true;
                    recognition.maxAlternatives = 1; // Only return the most likely result

                    recognition.onstart = () => {
                        listening = true;
                        startButton.style.display = 'none'; stopButton.style.display = 'inline-block';
                        outputDiv.textContent = "Listening...";
                    };

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

                    recognition.onerror = (event) => {
                        console.error('Speech recognition error detected: ' + event.error);
                        stopListening();
                    };

                    recognition.onend = () => {
                        if (listening) {
                            console.log('Speech recognition service disconnected unexpectedly. Restarting...');
                            recognition.start();
                        }
                    };

                    recognition.start();
                } catch (e) {
                    console.error('Speech recognition not supported in this browser: ', e);
                    alert('Speech recognition is not supported in your browser. Please use a compatible browser such as Google Chrome.');
                }
            }
        });

        stopButton.addEventListener('click', () => {
            if (recognition && listening) {
                recognition.stop();
                stopListening();
            }
        });
    }

    function stopListening() {
        listening = false;
        stopButton.style.display = 'none'; startButton.style.display = 'inline-block';
        outputDiv.textContent = `You said: "${finalTranscript}"`;
        fetchAnswer(finalTranscript);
    }

    function fetchAnswer(question) {
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
            finalTranscript = ''; // Clear the final transcript after fetching answer
        })
        .catch(error => {
            responseDiv.textContent = "Error: " + error;
        });
    }

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