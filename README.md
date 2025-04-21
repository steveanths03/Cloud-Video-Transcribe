# 🎬 Video Upload and Transcription App using AWS S3 and Amazon Transcribe

This web application enables users to upload video files, store them securely in AWS S3, and automatically transcribe them using Amazon Transcribe. Transcription results are viewable in the UI after processing.

---

## 🧰 Features

- Upload video files from a browser interface
- Store videos securely in an Amazon S3 bucket
- Trigger Amazon Transcribe jobs on file upload
- View transcripts directly on the frontend

---

## 🚀 Getting Started

### 1. Prerequisites

Make sure you have the following before starting:

- [Node.js](https://nodejs.org/) installed (v16 or later recommended)
- An [AWS account](https://aws.amazon.com/)
- An S3 bucket set up for uploads
- An IAM user with:
  - Programmatic access enabled
  - Permissions for S3 and Transcribe

---

## 🔧 AWS Configuration

### ✅ Create an S3 Bucket

1. Go to the **AWS Console → S3 → Create bucket**
2. Enter a **globally unique name** (e.g., `my-transcription-bucket`)
3. Choose the AWS region (e.g., `us-east-1`)
4. Leave the rest as default or configure to your needs
5. After creation, set the following **CORS policy** for development:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": []
  }
]

✅ Create an IAM User with Required Permissions
Go to the AWS Console → IAM → Users → Add users

Choose a username (e.g., transcribe-app-user)

Under Access type, check: ✅ Programmatic access

Click Next: Permissions

Choose Attach policies directly, then attach:

AmazonS3FullAccess

AmazonTranscribeFullAccess

Skip tags and proceed to Create user

On the final screen, download the .csv file or save the:

Access Key ID

Secret Access Key

These credentials will be used in your backend .env file to allow programmatic access to S3 and Transcribe.


# 🎙️ Video Transcriber Web App – AWS EC2 Deployment Guide

This guide walks through the process of deploying a video transcription web app on an AWS EC2 instance using Node.js, AWS Transcribe, and S3. Videos uploaded via the frontend are stored in an S3 bucket and transcribed using AWS Transcribe. Transcriptions are displayed on the console.

---

## ✅ 1. Launch an EC2 Instance

1. **Go to EC2 Dashboard → Launch Instance**
2. Choose:
   - **Amazon Linux 2 AMI**
   - **t2.micro** (Free Tier Eligible)
3. **Key Pair:** Create or select one (e.g., `my-key.pem`)
4. **Configure Security Group:**

### 🔐 Inbound Rules

| Type        | Protocol | Port Range | Source        |
|-------------|----------|------------|----------------|
| SSH         | TCP      | 22         | My IP          |
| HTTP        | TCP      | 80         | 0.0.0.0/0      |
| Custom TCP  | TCP      | 3000       | 0.0.0.0/0      |

5. Launch the instance and note:
   - **Public IPv4 address**
   - **Public DNS (IPv4)**

---

## 🔌 2. Connect to the EC2 Instance

```bash
ssh -i my-key.pem ec2-user@<your-public-ip>
