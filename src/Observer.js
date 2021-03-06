import GlobalEmitter from './GlobalEmitter';
import { eventToAction, unwrapIfSingle } from './utils';

const SYSTEM_EVENTS = ['connect', 'error', 'disconnect', 'reconnect', 'reconnect_attempt', 'reconnecting', 'reconnect_error', 'reconnect_failed', 'connect_error', 'connect_timeout', 'connecting', 'ping', 'pong'];

export default class Observer {
  constructor(connection, store) {
    this.Socket = connection;

    if (store) this.store = store;

    this.registerEventHandler();
  }

  registerEventHandler() {
    const superOnEvent = this.Socket.onevent;
    this.Socket.onevent = (packet) => {
      superOnEvent.call(this.Socket, packet);

      GlobalEmitter.emit(...packet.data);

      const [eventName, ...args] = packet.data;
      this.passToStore(`SOCKET_${eventName}`, [...args]);
    };

    SYSTEM_EVENTS.forEach((eventName) => {
      this.Socket.on(eventName, (...args) => {
        GlobalEmitter.emit(eventName, ...args);
        this.passToStore(`SOCKET_${eventName}`, [...args]);
      });
    });
  }


  passToStore(event, payload) {
    if (!this.store) return;
    if (!event.startsWith('SOCKET_')) return;
    const unwrappedPayload = unwrapIfSingle(payload);

    // eslint-disable-next-line no-underscore-dangle
    Object.keys(this.store._mutations)
      .forEach((namespacedMutation) => {
        const mutation = namespacedMutation.split('/').pop();
        if (mutation !== event.toUpperCase()) return;
        this.store.commit(namespacedMutation, unwrappedPayload);
      });

    // eslint-disable-next-line no-underscore-dangle
    Object.keys(this.store._actions)
      .forEach((namespacedAction) => {
        const action = namespacedAction.split('/').pop();
        if (!action.startsWith('socket_')) return;
        const camelcased = eventToAction(event);
        if (action !== camelcased) return;
        this.store.dispatch(namespacedAction, unwrappedPayload);
      });
  }
}
