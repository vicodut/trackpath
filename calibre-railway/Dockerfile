FROM linuxserver/calibre-web:latest

# 1. On installe les dépendances pour le script rclone (curl, bash, unzip)
# 'unzip' est celui qui manquait et causait l'erreur 4
RUN apk add --no-local --no-cache curl bash unzip

# 2. On installe rclone
RUN curl https://rclone.org/install.sh | bash

# 3. Dossier de travail
WORKDIR /app

# 4. On copie seulement le script d'entrée (plus besoin du rclone.conf si tu utilises les variables Railway)
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Port par défaut
EXPOSE 8083

# Lancement
ENTRYPOINT ["./entrypoint.sh"]