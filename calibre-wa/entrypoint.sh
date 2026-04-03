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

# 3. Background sync loop
(
  while true; do
    sleep 300
    rclone --config /app/rclone.conf sync /config r2:calibre-railway
  done
) &

# 4. Start CWA as PID 1
echo "Démarrage CWA..."
exec /init
