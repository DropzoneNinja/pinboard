import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: process.uptime() });
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
