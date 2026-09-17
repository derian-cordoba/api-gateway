import { EventEmitter } from "node:events";
import type { GatewayEvents } from "./GatewayEvents";

/**
 * Strongly-typed event bus for gateway-level lifecycle events.
 * Extends `EventEmitter` with typed `on`, `once`, `off`, and `emit` overloads
 * so callers get full IntelliSense without casting.
 */
export class GatewayEventBus extends EventEmitter {
  override on<EventName extends keyof GatewayEvents>(
    event: EventName,
    listener: (...args: GatewayEvents[EventName]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override once<EventName extends keyof GatewayEvents>(
    event: EventName,
    listener: (...args: GatewayEvents[EventName]) => void,
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  override off<EventName extends keyof GatewayEvents>(
    event: EventName,
    listener: (...args: GatewayEvents[EventName]) => void,
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  override emit<EventName extends keyof GatewayEvents>(
    event: EventName,
    ...args: GatewayEvents[EventName]
  ): boolean {
    return super.emit(event, ...args);
  }
}
