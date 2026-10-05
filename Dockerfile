FROM node:20-alpine
# git est nécessaire : une dépendance de Baileys est téléchargée depuis GitHub
RUN apk add --no-cache git
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
ENV NODE_ENV=production AUTH_DIR=/data/auth PORT=3000
VOLUME ["/data"]
EXPOSE 3000
USER node
CMD ["node", "src/index.js"]
