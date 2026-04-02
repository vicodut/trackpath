#!/bin/bash

# On génère le rclone.conf à la volée avec les variables Railway
cat <<EOF > /app/rclone.conf
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY}
secret_access_key = ${R2_SECRET_KEY}
endpoint = ${R2_ENDPOINT}
acl = private
EOF

# 1. On rapatrie la DB et les livres depuis R2
echo "Initialisation depuis R2..."
rclone --config /app/rclone.conf sync r2:calibre-railway /config

# 2. Lancement Calibre-Web
echo "Démarrage..."
chown -R abc:abc /config && chmod -R 775 /config
ls -la /config
python3 /app/calibre-web/cps.py -p /config/app.db &

# 3. Sync inverse toutes les 5 min
while true; do
  sleep 300
  rclone --config /app/rclone.conf sync /config r2:calibre-railway
done