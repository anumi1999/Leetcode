import express, { Request, Response, NextFunction } from 'express';
import router from './routes';
import { logger } from './logger';
import { seed } from './store';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl}`, { status: res.statusCode, ms: Date.now() - start });
  });
  next();
});

app.use('/', router);

seed();

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Recommendation Engine running on http://localhost:${PORT}`);
  });
}

export { app };
