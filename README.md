# image_processing_service
Receive images and change their formats via an Express.js backend.

## Setup
```bash
npm install
```

## Environment
Required:
- `IMAGE_BUCKET_NAME`
- `AWS_REGION`

Optional:
- `IMAGE_BUCKET_BASE_URL` (public base URL for assets)

AWS credentials should be provided via environment variables or an AWS profile.

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

## Requirements
- `ffmpeg` must be installed and available on the PATH for video thumbnails.

## Healthcheck
`GET /healthcheck`

## API

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
