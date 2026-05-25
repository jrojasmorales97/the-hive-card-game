#!/bin/sh
# Create a small JS file that exposes runtime envs to the browser
OUT=/usr/share/nginx/html/env-config.js
cat > "$OUT" <<EOF
window.__ENV = {
  VITE_SOCKET_URL: "${VITE_SOCKET_URL:-}"
};
EOF

# Start nginx
exec nginx -g 'daemon off;'
