document.addEventListener('DOMContentLoaded', function () {
    const listenButton = document.getElementById('start-stop-listening');
    const resumeUpload = document.getElementById('resume-upload');
    const submitResumeButton = document.getElementById('submit-resume');
    const outputDiv = document.getElementById('speech-output');
    const responseDiv = document.getElementById('response-output');
    const fileNameDisplay = document.getElementById('file-name');

    let recognition;
    let listening = false;
    let finalTranscript = '';

    // Resume upload handling
    if (resumeUpload && submitResumeButton) {
        resumeUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                fileNameDisplay.textContent = e.target.files[0].name;
                submitResumeButton.disabled = false;
            } else {
                fileNameDisplay.textContent = 'No file chosen';
                submitResumeButton.disabled = true;
            }
        });

        submitResumeButton.addEventListener('click', (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('resume', resumeUpload.files[0]);
        
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/ask_question';
                } else {
                    throw new Error(data.error || 'Unknown error');
                }
            })
            .catch(error => {
                alert('Error: ' + error);
            });
        });
    }

    // Speech recognition handling
    if (listenButton) {
        listenButton.addEventListener('click', () => {
            if (listening) {
                stopListening();
            } else {
                startListening();
            }
        });
    }

    function startListening() {
        if (!listening) {
            try {
                recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.maxAlternatives = 1;

                recognition.onstart = () => {
                    listening = true;
                    listenButton.textContent = 'Stop Listening';
                    outputDiv.innerHTML = '<p class="placeholder">Listening...</p>';
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
                    outputDiv.innerHTML = `<p>You said: "${finalTranscript}${interimTranscript}"</p>`;
                };

                recognition.onerror = (event) => {
                    console.error('Speech recognition error detected: ' + event.error);
                    stopListening();
                };

                recognition.onend = () => {
                    if (listening) {
                        recognition.start();
                    }
                };

                recognition.start();
            } catch (e) {
                console.error('Speech recognition not supported in this browser: ', e);
                alert('Speech recognition is not supported in your browser. Please use a compatible browser such as Google Chrome.');
            }
        }
    }

    function stopListening() {
        if (recognition && listening) {
            recognition.stop();
            listening = false;
            listenButton.textContent = 'Start Listening';
            outputDiv.innerHTML = `<p>You said: "${finalTranscript}"</p>`;
            fetchAnswer(finalTranscript);
        }
    }

    function fetchAnswer(question) {
        responseDiv.innerHTML = '<p class="placeholder">Fetching response...</p>';
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
                responseDiv.innerHTML = `<p class="error">Error: ${data.error || 'Unknown error'}</p>`;
            }
            finalTranscript = '';
        })
        .catch(error => {
            responseDiv.innerHTML = `<p class="error">Error: ${error}</p>`;
        });
    }

    function formatResponse(response) {
        if (!response) return '';

        response = response.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        response = response.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #2ecc71;">$1</strong>');

        const parts = response.split('\n');
        let formattedResponse = '';
        let inList = false;

        for (const part of parts) {
            if (part.trim().startsWith('* ')) {
                const listItem = part.trim().substring(2);
                if (!inList) {
                    formattedResponse += '<ul>';
                    inList = true;
                }
                formattedResponse += `<li style="color: #ffffff;">${listItem}</li>`;
            } else if (part.trim() !== '') {
                if (inList) {
                    formattedResponse += '</ul>';
                    inList = false;
                }
                formattedResponse += `<p style="color: #ffffff;">${part.trim()}</p>`;
            }
        }
        if (inList) {
            formattedResponse += '</ul>';
        }

        return formattedResponse;
    }
});
