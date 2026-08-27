import { EventEmitter } from 'events';
import type { File } from '../db/schema/files';

// ── Typed event map ───────────────────────────────────────────────────────────
interface Events {
  'file.uploaded': [file: File];
  'file.deleted': [fileId: string, s3Key: string];
  'share.created': [shareId: string];
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
eventBus.setMaxListeners(50);
