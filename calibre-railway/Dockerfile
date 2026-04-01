FROM linuxserver/calibre-web:latest

# 1. On utilise apt-get au lieu de apk
# On installe curl, unzip et rclone (il est dans les dépôts debian, c'est plus simple !)
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    rclone \
    && rm -rf /var/lib/apt/lists/*

# 2. Dossier de travail
WORKDIR /app

# 3. On copie le script d'entrée
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Port par défaut
EXPOSE 8083

# Lancement
ENTRYPOINT ["./entrypoint.sh"]