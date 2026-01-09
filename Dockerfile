FROM node:20-bullseye AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM public.ecr.aws/lambda/nodejs:20
WORKDIR /var/task

# Install ffmpeg for video thumbnailing.
RUN microdnf install -y tar xz \
  && curl -L -o /tmp/ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
  && tar -xf /tmp/ffmpeg.tar.xz -C /tmp \
  && cp /tmp/ffmpeg-*-static/ffmpeg /usr/local/bin/ffmpeg \
  && cp /tmp/ffmpeg-*-static/ffprobe /usr/local/bin/ffprobe \
  && rm -rf /tmp/ffmpeg* \
  && microdnf clean all

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

CMD ["dist/lambda.handler"]
