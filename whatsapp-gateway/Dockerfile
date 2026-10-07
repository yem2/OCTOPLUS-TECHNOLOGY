FROM node:22-slim
# git est nécessaire : une dépendance de Baileys est téléchargée depuis GitHub pendant l'installation
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./
ENV AUTH_DIR=/data/auth PORT=8080
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "index.js"]
