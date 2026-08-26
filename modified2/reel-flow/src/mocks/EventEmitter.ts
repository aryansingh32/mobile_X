class EventEmitter {
  private listeners: Record<string, Function[]> = {};

  addListener(eventType: string, listener: Function) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(listener);
    return {
      remove: () => {
        this.listeners[eventType] = this.listeners[eventType]?.filter(l => l !== listener) || [];
      }
    };
  }

  emit(eventType: string, ...args: any[]) {
    this.listeners[eventType]?.forEach(listener => {
      try {
        listener(...args);
      } catch (e) {
        console.error('Error in event listener:', e);
      }
    });
  }

  removeAllListeners(eventType?: string) {
    if (eventType) {
      delete this.listeners[eventType];
    } else {
      this.listeners = {};
    }
  }
}

module.exports = EventEmitter;
