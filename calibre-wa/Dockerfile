FROM crocodilestick/calibre-web-automated:latest

RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    rclone \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 8083

ENTRYPOINT ["./entrypoint.sh"]
