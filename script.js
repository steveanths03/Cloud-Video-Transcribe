document.addEventListener('DOMContentLoaded', function() {
    const videoInput = document.getElementById('videoInput');
    const uploadButton = document.getElementById('uploadButton');
    const videoPreview = document.getElementById('videoPreview');
    const progressContainer = document.getElementById('progressContainer');
    const progress = document.getElementById('progress');
    const status = document.getElementById('status');
    const transcriptionContainer = document.getElementById('transcriptionContainer');
    const transcriptionStatus = document.getElementById('transcriptionStatus');
    const transcriptionText = document.getElementById('transcriptionText');
    const checkStatusButton = document.getElementById('checkStatusButton');
    
    let currentJobName = null;
    
    // Enable upload button when a file is selected
    videoInput.addEventListener('change', function() {
        if (videoInput.files.length > 0) {
            uploadButton.disabled = false;
            
            // Show video preview
            const file = videoInput.files[0];
            const videoURL = URL.createObjectURL(file);
            videoPreview.src = videoURL;
            videoPreview.style.display = 'block';
        } else {
            uploadButton.disabled = true;
            videoPreview.style.display = 'none';
        }
    });
    
    // Handle upload when button is clicked
    uploadButton.addEventListener('click', function() {
        if (videoInput.files.length === 0) return;
        
        const file = videoInput.files[0];
        const formData = new FormData();
        formData.append('video', file);
        
        // Show progress container
        progressContainer.style.display = 'block';
        status.textContent = 'Uploading...';
        
        // Send file to server
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload', true);
        
        // Track upload progress
        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progress.style.width = percentComplete + '%';
                progress.textContent = percentComplete + '%';
            }
        };
        
        // Handle response
        xhr.onload = function() {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                status.textContent = 'Upload successful! S3 URL: ' + response.videoLocation;
                
                // Show transcription container
                transcriptionContainer.style.display = 'block';
                currentJobName = response.transcriptionJob.jobName;
                
                // Update transcription status
                transcriptionStatus.textContent = `Transcription job started. Status: ${response.transcriptionJob.status}`;
                transcriptionText.textContent = 'Transcription in progress. Please check status periodically.';
                
                // Enable check status button
                checkStatusButton.disabled = false;
            } else {
                status.textContent = 'Upload failed: ' + xhr.statusText;
            }
        };
        
        xhr.onerror = function() {
            status.textContent = 'Upload failed: Network error';
        };
        
        // Send the form data
        xhr.send(formData);
    });
    
    // Handle check status button
    checkStatusButton.addEventListener('click', function() {
        if (!currentJobName) return;
        
        // Update UI
        transcriptionStatus.textContent = 'Checking transcription status...';
        
        // Make request to check status
        fetch(`/transcription-status/${currentJobName}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    transcriptionStatus.textContent = `Transcription Status: ${data.status}`;
                    
                    if (data.status === 'COMPLETED' && data.transcriptFileUri) {
                        // First check if we have direct access to the transcript content
                        if (data.transcriptContent) {
                            try {
                                // Parse the transcript content
                                const transcriptData = JSON.parse(data.transcriptContent);
                                const transcript = transcriptData.results.transcripts[0].transcript;
                                transcriptionText.textContent = transcript;
                            } catch (e) {
                                transcriptionText.textContent = `Error parsing transcript: ${e.message}`;
                            }
                        } else {
                            // Fetch the transcript file but don't assume it's JSON
                            fetch(data.transcriptFileUri)
                                .then(response => response.text())  // Get as text instead of JSON
                                .then(responseText => {
                                    try {
                                        // Try to parse as JSON first
                                        if (responseText.trim().startsWith('{')) {
                                            const transcriptData = JSON.parse(responseText);
                                            const transcript = transcriptData.results.transcripts[0].transcript;
                                            transcriptionText.textContent = transcript;
                                        } 
                                        // Handle XML format
                                        else if (responseText.trim().startsWith('<?xml')) {
                                            // For XML we need to extract the transcript differently
                                            // This is a simple approach - might need refinement based on exact XML structure
                                            const parser = new DOMParser();
                                            const xmlDoc = parser.parseFromString(responseText, "text/xml");
                                            
                                            // Try to find transcript in the XML structure
                                            const transcriptElements = xmlDoc.getElementsByTagName("transcript");
                                            
                                            if (transcriptElements.length > 0) {
                                                transcriptionText.textContent = transcriptElements[0].textContent;
                                            } else {
                                                // If we can't find the transcript, display the raw XML for debugging
                                                transcriptionText.textContent = "Could not extract transcript from XML. Raw content:\n\n" + responseText;
                                            }
                                        } else {
                                            // If neither JSON nor XML, just show the raw text
                                            transcriptionText.textContent = responseText;
                                        }
                                    } catch (error) {
                                        transcriptionText.textContent = `Error processing transcript: ${error.message}\n\nRaw content:\n${responseText.substring(0, 1000)}...`;
                                    }
                                })
                                .catch(error => {
                                    transcriptionText.textContent = `Error fetching transcript: ${error.message}`;
                                });
                        }
                    } else if (data.status === 'FAILED') {
                        transcriptionText.textContent = 'Transcription job failed. Please try again.';
                    } else {
                        transcriptionText.textContent = `Transcription in progress. Status: ${data.status}`;
                    }
                } else {
                    transcriptionStatus.textContent = `Error: ${data.error}`;
                }
            })
            .catch(error => {
                transcriptionStatus.textContent = `Error checking status: ${error.message}`;
            });
    });
});