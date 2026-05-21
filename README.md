# Typing Arcade

Web trainer for touch typing with EN/RU layouts, game modes, a colored keyboard, and challenge text mode.

## Local Development

```bash
npm install
npm run dev
```

## Docker

Build and run the production container:

```bash
docker build -t blind-type-trainer .
docker run --rm -p 8080:80 blind-type-trainer
```

Open `http://localhost:8080`.
