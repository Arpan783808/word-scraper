# Use a lightweight Node.js image
FROM node:18-slim

# Install dependencies
RUN apt-get update && apt-get install -y wget unzip \
    && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm -rf /var/lib/apt/lists/* ./google-chrome-stable_current_amd64.deb

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the entire project
COPY . .

# Expose the port
EXPOSE 3001

# Start the application
CMD ["node", "index.js"]