import app from './app';
import { startOutboxWorker } from './modules/notifications/outbox.worker';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  startOutboxWorker();
});
