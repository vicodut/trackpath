FROM linuxserver/calibre-web:latest

# Installation de rclone
RUN curl https://rclone.org/install.sh | bash

# Dossier de travail
WORKDIR /app

# Copie des fichiers de config et du script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Port par défaut de Calibre-Web
EXPOSE 8083

# On lance notre script au lieu du binaire par défaut
ENTRYPOINT ["./entrypoint.sh"]