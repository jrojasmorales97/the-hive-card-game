import type { ApplicationResult } from './result.js';
import type { ApplicationEventPublisher } from './ports/eventPublisher.js';
import type { Scheduler } from './ports/scheduler.js';

/** The only effect materializer: callers receive the result but never republish it. */
export function dispatchApplicationResult<T>(result: ApplicationResult<T>, publisher: ApplicationEventPublisher, scheduler: Scheduler): ApplicationResult<T> {
  if (!result.ok) return result;
  for (const event of result.events) publisher.publish(event);
  for (const effect of result.effects) scheduler.schedule(effect.roomCode, effect.trigger, effect);
  return result;
}
