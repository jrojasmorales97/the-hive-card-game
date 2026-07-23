import type { ApplicationEvent } from '../result.js';

/** Events are published strictly in supplied order, after the room commit. */
export interface ApplicationEventPublisher { publish(event: ApplicationEvent): void; }
