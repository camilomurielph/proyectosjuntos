# Usa Node.js 18 LTS con herramientas de compilación
FROM node:18-slim

# Instala Python, make, g++ y librerías de SQLite (necesarias para better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
