FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# O lockfile está no .gitignore do repo, então npm install funciona com ou sem ele.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY app.js ./
COPY src ./src
COPY public ./public

EXPOSE 8080

CMD ["npm", "start"]
