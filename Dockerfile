FROM node:20-alpine

WORKDIR /app

COPY app/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY app/ .

EXPOSE 3000

USER node

CMD ["node", "server.js"]
