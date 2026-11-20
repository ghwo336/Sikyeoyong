#!/bin/sh
# Local HTTPS for development (the Pouchi SDK opens its vault only for an https callback, D-29).
# Makes a local CA and a localhost certificate in .certs/ (git-ignored). Run once.
# Trust: iOS simulator `xcrun simctl keychain booted add-root-cert .certs/dev-ca.pem` (no password);
# macOS browsers need the CA in the login keychain (asks for your password, do it yourself):
#   security add-trusted-cert -r trustRoot -k ~/Library/Keychains/login.keychain-db .certs/dev-ca.pem
set -eu
cd "$(dirname "$0")/.."
mkdir -p .certs
cd .certs
[ -f dev-ca.pem ] || openssl req -x509 -new -nodes -newkey rsa:2048 -days 825 \
  -keyout dev-ca-key.pem -out dev-ca.pem -subj "/CN=sikyeoyong local dev CA" >/dev/null 2>&1
cat > localhost.ext <<'EXT'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,IP:127.0.0.1
EXT
openssl req -new -nodes -newkey rsa:2048 -keyout localhost-key.pem -out localhost.csr \
  -subj "/CN=localhost" >/dev/null 2>&1
openssl x509 -req -in localhost.csr -CA dev-ca.pem -CAkey dev-ca-key.pem -CAcreateserial \
  -out localhost.pem -days 825 -sha256 -extfile localhost.ext >/dev/null 2>&1
chmod 600 dev-ca-key.pem localhost-key.pem
echo "made .certs/localhost.pem (CA .certs/dev-ca.pem)"
