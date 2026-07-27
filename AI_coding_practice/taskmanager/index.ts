import express, { Request, Response, NextFunction } from 'express';
import taskRouter from './core/route';
import { logger } from './core/logger';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
});

app.use('/tasks', taskRouter);

app.listen(PORT, () => {
  logger.info(`Task Manager API running on http://localhost:${PORT}`);
});

export { app };
