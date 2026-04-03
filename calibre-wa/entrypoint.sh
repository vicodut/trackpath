#!/bin/bash

# Generate rclone config from Railway env vars
cat <<EOF > /app/rclone.conf
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY}
secret_access_key = ${R2_SECRET_KEY}
endpoint = ${R2_ENDPOINT}
acl = private
EOF

# 1. Pull config and library from R2
echo "Initialisation depuis R2..."
rclone --config /app/rclone.conf sync r2:calibre-railway /config

# 2. Fix permissions
chown -R abc:abc /config
chmod -R 775 /config

# 3. Start CWA via its init system
echo "Démarrage CWA..."
/init &

# 4. Sync back to R2 every 5 min
while true; do
  sleep 300
  rclone --config /app/rclone.conf sync /config r2:calibre-railway
done
