require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Initialize Express app
const app = express();
const port = 3000;

// Enable CORS for your local development
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Create AWS service objects
const s3 = new AWS.S3();
const transcribe = new AWS.TranscribeService();

// Set up multer storage for temporary file storage
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Initialize multer upload
const upload = multer({ storage: storage });

// Home route - serve the index.html page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Upload route - handle video uploads
app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Read the file from disk
    const fileContent = fs.readFileSync(req.file.path);
    
    // Generate a unique filename for S3
    const s3FileName = `videos/${Date.now()}-${req.file.originalname}`;
    
    // Set up S3 upload parameters
    const s3Params = {
        Bucket: process.env.S3_BUCKET,
        Key: s3FileName,
        Body: fileContent,
        ContentType: req.file.mimetype
    };

    // Upload the file to S3
    s3.upload(s3Params, (err, s3Data) => {
        // Clean up - delete the temporary file
        fs.unlinkSync(req.file.path);

        if (err) {
            console.error("Error uploading to S3:", err);
            return res.status(500).send(err);
        }

        // Generate a unique job name for Transcribe
        const jobName = `transcription-${Date.now()}`;
        
        // Create a media file URI from the S3 location
        const mediaFileUri = `s3://${process.env.S3_BUCKET}/${s3FileName}`;
        
        // Set up Transcribe parameters
        const transcribeParams = {
            TranscriptionJobName: jobName,
            LanguageCode: 'en-US', // Change this based on your video language
            MediaFormat: path.extname(req.file.originalname).substring(1), // Get file extension without dot
            Media: {
                MediaFileUri: mediaFileUri
            },
            OutputBucketName: process.env.S3_BUCKET,
            OutputKey: `transcriptions/${jobName}.json`
        };

        // Start transcription job
        transcribe.startTranscriptionJob(transcribeParams, (transcribeErr, transcribeData) => {
            if (transcribeErr) {
                console.error("Error starting transcription job:", transcribeErr);
                return res.status(500).json({
                    success: true,
                    videoLocation: s3Data.Location,
                    transcriptionError: transcribeErr.message
                });
            }

            // Return success response with file location and transcription job info
            res.json({
                success: true,
                videoLocation: s3Data.Location,
                transcriptionJob: {
                    jobName: jobName,
                    status: transcribeData.TranscriptionJob.TranscriptionJobStatus,
                    estimatedCompletionTime: "The transcription job will take some time to complete."
                }
            });
        });
    });
});

// Function to download file content from a URL
function downloadContent(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            
            // A chunk of data has been received
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            // The whole response has been received
            response.on('end', () => {
                resolve(data);
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Route to check transcription job status
app.get('/transcription-status/:jobName', async (req, res) => {
    const jobName = req.params.jobName;
    
    const params = {
        TranscriptionJobName: jobName
    };
    
    try {
        const data = await transcribe.getTranscriptionJob(params).promise();
        const job = data.TranscriptionJob;
        
        let response = {
            success: true,
            jobName: job.TranscriptionJobName,
            status: job.TranscriptionJobStatus,
            completionTime: job.CompletionTime,
            transcriptFileUri: job.TranscriptionJobStatus === 'COMPLETED' ? job.Transcript.TranscriptFileUri : null
        };
        
        // If completed, try to get the transcript content directly from S3
        if (job.TranscriptionJobStatus === 'COMPLETED' && job.Transcript && job.Transcript.TranscriptFileUri) {
            try {
                // Try to extract the S3 key from the job output
                const s3Key = `transcriptions/${jobName}.json`;
                
                // Get the transcript from S3
                const s3Params = {
                    Bucket: process.env.S3_BUCKET,
                    Key: s3Key
                };
                
                try {
                    const s3Data = await s3.getObject(s3Params).promise();
                    if (s3Data && s3Data.Body) {
                        response.transcriptContent = s3Data.Body.toString();
                    }
                } catch (s3Error) {
                    console.log('Could not retrieve transcript from S3 directly:', s3Error);
                    // Fall back to the URI provided by Transcribe
                }
            } catch (error) {
                console.log('Error processing transcript data:', error);
            }
        }
        
        res.json(response);
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});