import path from 'path';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import { errorHandler } from './shared/errors';
import authRouter from './modules/auth/auth.router';
import resourcesRouter from './modules/resources/resources.router';
import appointmentsRouter from './modules/appointments/appointments.router';
import vehiclesRouter from './modules/vehicles/vehicles.router';
import webhooksRouter from './modules/webhooks/webhooks.router';

const app = express();
app.use(express.json());

const openApiSpec = YAML.parse(fs.readFileSync(path.join(__dirname, '../docs/openapi.yaml'), 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/auth', authRouter);
app.use('/admin', resourcesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/webhooks', webhooksRouter);

app.use(errorHandler);

export default app;
