FROM node:20-alpine

WORKDIR /app

# Copia só os manifests primeiro para aproveitar o cache de camadas
COPY package*.json ./
RUN npm install --omit=dev

# Copia o restante do projeto (app.js, src/, Public/)
COPY . .

# Porta definida no APP_PORT do .env
EXPOSE 8080

# Roda como usuário não-root
USER node

CMD ["node", "app.js"]