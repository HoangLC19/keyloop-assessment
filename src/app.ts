import express from 'express';
import { errorHandler } from './shared/errors';

const app = express();
app.use(express.json());

// Routers registered in later tasks

app.use(errorHandler);

export default app;
