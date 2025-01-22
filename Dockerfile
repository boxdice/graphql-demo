FROM node:18-bullseye

RUN apt-get update && apt-get install -y sqlite3

WORKDIR /usr/src/app

COPY package*.json ./

COPY . .
CMD ["sh", "-c", "npm install && npm run start"]

