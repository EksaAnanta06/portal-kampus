FROM node:20-alpine

WORKDIR /app

# Salin package.json dan package-lock.json
COPY package*.json ./

# Install dependensi produksi
RUN npm ci --omit=dev

# Salin source code server
COPY . .

# Environment default
ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["node", "src/server.js"]
