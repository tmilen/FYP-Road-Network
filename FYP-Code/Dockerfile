FROM nginx:latest

COPY nginx.conf /etc/nginx/nginx.conf

# Add this line to ensure the log directory exists
RUN mkdir -p /var/log/nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]