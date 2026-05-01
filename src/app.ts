import express from 'express';
import { errorHandler } from './shared/errors';
import authRouter from './modules/auth/auth.router';
import resourcesRouter from './modules/resources/resources.router';

const app = express();
app.use(express.json());

app.use('/auth', authRouter);
app.use('/admin', resourcesRouter);

app.use(errorHandler);

export default app;
