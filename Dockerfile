# Use the official Node.js 18 image with Debian Bullseye
FROM node:18-bullseye

# Install SQLite
RUN apt-get update && apt-get install -y sqlite3

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies, including devDependencies
RUN npm install --include=dev

# Copy the rest of the application code
COPY . .

# Start the application
CMD ["npm", "run", "start"]

