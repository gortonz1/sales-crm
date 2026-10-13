export class AutomationError extends Error {
  retry: boolean;
  constructor(message: string, retry = false) {
    super(message);
    this.retry = retry;
  }
}
