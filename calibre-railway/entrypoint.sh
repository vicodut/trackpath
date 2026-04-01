#!/bin/bash

# 1. On rapatrie la DB et les livres depuis R2 vers le dossier local /app/config
echo "Initialisation de la bibliothèque depuis R2..."
rclone --config ./rclone.conf sync r2:mon-bucket-livres /app/config

# 2. On lance Calibre-Web en arrière-plan
echo "Démarrage de Calibre-Web..."
python /app/calibre-web/cps.py &

# 3. (Optionnel) Boucle infinie pour renvoyer les modifs vers R2 toutes les 30 min
# Utile si tu édites des métadonnées directement dans l'interface web
while true; do
  sleep 1800
  echo "Sauvegarde des modifs vers R2..."
  rclone --config ./rclone.conf sync /app/config r2:mon-bucket-livres
done