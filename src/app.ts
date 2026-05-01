import express from 'express';
import { errorHandler } from './shared/errors';
import authRouter from './modules/auth/auth.router';

const app = express();
app.use(express.json());

app.use('/auth', authRouter);

app.use(errorHandler);

export default app;
