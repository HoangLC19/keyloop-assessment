import express from 'express';
import { errorHandler } from './shared/errors';
import authRouter from './modules/auth/auth.router';
import resourcesRouter from './modules/resources/resources.router';
import appointmentsRouter from './modules/appointments/appointments.router';
import vehiclesRouter from './modules/vehicles/vehicles.router';
import webhooksRouter from './modules/webhooks/webhooks.router';

const app = express();
app.use(express.json());

app.use('/auth', authRouter);
app.use('/admin', resourcesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/webhooks', webhooksRouter);

app.use(errorHandler);

export default app;
