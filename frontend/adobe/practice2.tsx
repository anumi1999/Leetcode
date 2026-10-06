type DebouncedFn<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
};

function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options?: { leading?: boolean; trailing?: boolean }
): DebouncedFn<T>{
    const leading = options?.leading ?? false;
    const trailing = options?.trailing ?? true;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastArgs: Parameters<T> | undefined;
    let lastThis: ThisParameterType<T> | undefined;
    let lastResult: ReturnType<T> | undefined;

    const invoke = () => {
      if (!lastArgs) return undefined;
      lastResult = fn.apply(lastThis as ThisParameterType<T>, lastArgs);
      return lastResult;
    };

    const clearPending = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const debounced = function (this: ThisParameterType<T>, ...args: Parameters<T>) {
      lastArgs = args;
      lastThis = this;

      const isFirstInWindow = timer === undefined;

      clearPending();

      if (leading && isFirstInWindow) {
        invoke();
      }

      timer = setTimeout(() => {
        timer = undefined;
        if (trailing && lastArgs) {
          invoke();
        }
      }, wait);
    } as DebouncedFn<T>;

    debounced.cancel = () => {
      clearPending();
      lastArgs = undefined;
      lastThis = undefined;
    };

    debounced.flush = () => {
      if (!timer || !lastArgs) return undefined;
      clearPending();
      return invoke();
    };

    return debounced;
}