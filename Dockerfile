FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json README.md ./
COPY src ./src
COPY data ./data

CMD ["npm", "run", "experiment"]
