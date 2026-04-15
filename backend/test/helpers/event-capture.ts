import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface EventCapture {
  getEmitted(name: string): unknown[];
  reset(): void;
}

export function captureEvents(app: INestApplication): EventCapture {
  const emitter = app.get(EventEmitter2);
  const captured: Array<{ name: string; payload: unknown }> = [];

  emitter.onAny((name, payload) => {
    captured.push({ name: String(name), payload });
  });

  return {
    getEmitted: (name) =>
      captured.filter((e) => e.name === name).map((e) => e.payload),
    reset: () => {
      captured.length = 0;
    },
  };
}
