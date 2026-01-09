https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/2560px-Google_2015_logo.svg.png

https://media.wired.com/photos/5926ffe47034dc5f91bed4e8/3:2/w_1920,c_limit/google-logo.jpg

docker build -t image-processing-service .
docker run -p 9000:8080 --env-file .env image-processing-service

https://srk3rzk3j5.execute-api.us-east-1.amazonaws.com/process?url=https://media.wired.com/photos/5926ffe47034dc5f91bed4e8/3:2/w_1920,c_limit/google-logo.jpg&width=100&height=150&format=png&quality=80&crop=fill