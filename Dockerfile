# Usa Node.js 18 LTS con herramientas de compilación
FROM node:18-slim

# Instala Python, make, g++ y librerías de SQLite (necesarias para better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de dependencias primero (para aprovechar caché)
COPY package*.json ./

# Instala dependencias (solo producción)
RUN npm ci --only=production

# Copia el resto del código
COPY . .

# Expone el puerto (por defecto 3000, pero Coolify usará el de la variable PORT)
EXPOSE 3000

# Comando de inicio
CMD ["node", "server.js"]
