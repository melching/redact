# Use an official lightweight Nginx image
FROM nginx:stable-alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default Nginx welcome page
RUN rm -f index.html

# Copy the website files into the Nginx html directory
COPY index.html .
COPY style.css .
COPY script.js .

# Expose port 80
EXPOSE 80

# The default Nginx entrypoint starts the server
# CMD ["nginx", "-g", "daemon off;"] is implicitly handled by the base image 