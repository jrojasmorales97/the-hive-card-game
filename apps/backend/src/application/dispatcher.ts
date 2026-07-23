import type { ApplicationResult } from './result.js';
import type { ApplicationEventPublisher } from './ports/eventPublisher.js';
import type { Scheduler } from './ports/scheduler.js';

/** The only effect materializer: callers receive the result but never republish it. */
export function dispatchApplicationResult<T>(result: ApplicationResult<T>, publisher: ApplicationEventPublisher, scheduler: Scheduler): ApplicationResult<T> {
  if (!result.ok) return result;
  for (const directive of result.directives) {
    if (directive.type === 'cancel') scheduler.cancel(directive.roomCode, directive.trigger);
    if (directive.type === 'cancel-room') scheduler.cancelRoom(directive.roomCode);
  }
  for (const event of result.events) publisher.publish(event);
  for (const directive of result.directives) {
    if (directive.type !== 'replace') continue;
    scheduler.cancel(directive.effect.roomCode, directive.effect.trigger);
    scheduler.schedule(directive.effect.roomCode, directive.effect.trigger, directive.effect);
  }
  return result;
}
