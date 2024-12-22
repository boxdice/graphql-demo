# Use the official Node.js 18 image with Debian Bullseye
FROM node:18-bullseye

RUN apt-get update && apt-get install -y sqlite3

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --include=dev

COPY . .
CMD ["npm", "run", "start"]

