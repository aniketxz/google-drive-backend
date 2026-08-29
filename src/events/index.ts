import { EventEmitter } from 'events';
import type { File } from '../db/schema/files';
import { DOMAIN_EVENTS, EVENT_BUS_MAX_LISTENERS } from '../constants';

// ── Typed event map ───────────────────────────────────────────────────────────
interface Events {
  [DOMAIN_EVENTS.FILE_UPLOADED]: [file: File];
  [DOMAIN_EVENTS.FILE_DELETED]: [fileId: string, s3Key: string];
  [DOMAIN_EVENTS.SHARE_CREATED]: [shareId: string];
}

// ── Typed EventEmitter ────────────────────────────────────────────────────────
class TypedEventBus extends EventEmitter {
  emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    return super.on(event, listener);
  }

  once<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    return super.once(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    return super.off(event, listener);
  }
}

export const eventBus = new TypedEventBus();
// Prevent memory leak warnings for high listener counts in large apps
eventBus.setMaxListeners(EVENT_BUS_MAX_LISTENERS);

