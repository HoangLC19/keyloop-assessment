import crypto from 'crypto';
import axios from 'axios';
import nodemailer from 'nodemailer';
import prisma from '../../shared/db/client';
import { webhooksRepository } from '../webhooks/webhooks.repository';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
});

async function deliverWebhook(url: string, secret: string, eventId: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': sig, 'X-Event-Id': eventId },
    timeout: 5000,
    maxRedirects: 0,
  });
}

export async function processOutboxEvent(row: { id: string; eventType: string; payload: unknown }): Promise<void> {
  const payload = row.payload as Record<string, unknown>;

  if (payload.customerId) {
    const user = await prisma.user.findUnique({
      where: { id: payload.customerId as string },
      select: { email: true },
    });
    if (user) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'noreply@keyloop.local',
        to: user.email,
        subject: `Appointment ${row.eventType.replace('appointment.', '')}`,
        text: `Your appointment (${payload.appointmentId}) status: ${row.eventType.replace('appointment.', '')}.`,
      });
    }
  }

  const customerId = payload.customerId as string;
  const subs = await webhooksRepository.findByEventForUser(row.eventType, customerId);
  const results = await Promise.allSettled(
    subs.map((s) => deliverWebhook(s.url, s.secret, row.id, { ...payload, eventType: row.eventType }))
  );
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`${failures.length} webhook(s) failed: ${failures.map((f) => String(f.reason)).join('; ')}`);
  }
}
