Use the official Nginx image
FROM nginx:latest

Copy your Nginx configuration file to the container
COPY nginx.conf /etc/nginx/nginx.conf

Expose port 80
EXPOSE 80

Start Nginx
CMD ["nginx", "-g", "daemon off;"]