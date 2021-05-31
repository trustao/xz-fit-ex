
export class SampleEvent {
  private events: {[k: string]: Function[]} = {};

  on(type: string, callback: Function) {
    if (!this.events[type]) {
      this.events[type] = [callback];
    } else {
      this.events[type].push(callback);
    }
  }
  emit(type: string, ...args: any[]) {
    if (this.events[type]) {
      this.events[type].forEach(fn => {
        fn.apply(null, args)
      });
    }
  }
  off(type: string, callback: Function) {
    if (callback) {
      const idx = this.events[type]?.findIndex(fn => fn === callback);
      if (idx >= 0) this.events[type].splice(idx, 1);
    } else {
      this.events[type] = null;
    }
  }
}
