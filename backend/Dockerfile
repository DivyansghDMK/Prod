# Use an official Node.js runtime as the base image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json first (for layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 4000

# Set environment variable for production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
