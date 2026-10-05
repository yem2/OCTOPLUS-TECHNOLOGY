FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./
ENV AUTH_DIR=/data/auth PORT=8080
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "index.js"]
