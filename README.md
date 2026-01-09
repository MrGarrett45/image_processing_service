# image_processing_service
Receive images and change their formats via an Express.js backend. Returns a link to an S3 bucket where the reformated image
is hosted.

## Quick testing
This application is already deployed behind API Gateway (uses Lambda/ECR integration) at the following address:
https://srk3rzk3j5.execute-api.us-east-1.amazonaws.com/

Some quick endpoints to hit to verify functionality:
https://srk3rzk3j5.execute-api.us-east-1.amazonaws.com/process?url=https://media.wired.com/photos/5926ffe47034dc5f91bed4e8/3:2/w_1920,c_limit/google-logo.jpg&width=100&height=150&format=png&quality=80&crop=fill

https://srk3rzk3j5.execute-api.us-east-1.amazonaws.com/video/thumbnail?url=https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4&time=26&width=320

## Setup
```bash
npm install
```

## Requirements
To run the thumbnail endpoint locally, `ffmpeg` must be installed and available on your PATH for video thumbnails.

Windows (winget):
```
winget install Gyan.FFmpeg
```

Windows (choco):
```
choco install ffmpeg
```

macOS (Homebrew):
```
brew install ffmpeg
```

## Environment
Required:
- `IMAGE_BUCKET_NAME` (message me for bucket name for easiest testing)
- `AWS_REGION`
- `IMAGE_BUCKET_BASE_URL` (public base URL for assets)

Create a `.env` file (see `.env.example`) and set the values there.

## Run (dev)
```bash
npm run dev
```

## Build + run
```bash
npm run build
npm start
```

## Tests
```bash
npm test
```

## API

## Healthcheck
`GET /healthcheck`

### GET /process
Example:
```
GET /process?url=https://example.com/image.jpg&width=500&height=300&format=webp&quality=80&crop=fill
```

Response:
```json
{
  "url": "https://.../images/<hash>.webp",
  "key": "images/<hash>.webp",
  "cached": false,
  "width": 500,
  "height": 300,
  "format": "webp"
}
```

### GET /video/thumbnail
(Works best on short videos, longer videos may result in timeout/rejection)
Example:
```
GET /video/thumbnail?url=https://example.com/video.mp4&time=2&width=320
```

Response:
```json
{
  "url": "https://.../thumbnails/<hash>.jpeg",
  "key": "thumbnails/<hash>.jpeg",
  "cached": false,
  "width": 320,
  "height": 180,
  "format": "jpeg"
}
```

Caching: identical inputs map to the same S3 key. If the object exists, the API returns `cached: true` without reprocessing.
