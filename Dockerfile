# Use Puppeteer base image
FROM ghcr.io/puppeteer/puppeteer:24.2.0

# Set user to root to install dependencies
USER root

# Install dependencies
RUN apt-get update && apt-get install -y wget unzip gnupg

# Install Google Chrome
RUN wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /usr/share/keyrings/google-chrome-keyring.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/google-chrome-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main' | tee /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable

# Switch back to the non-root user
USER pptruser

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port
EXPOSE 3001

# Start the application
CMD ["node", "index.js"]
