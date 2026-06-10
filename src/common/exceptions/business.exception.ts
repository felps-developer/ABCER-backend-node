export class BusinessException extends Error {
  constructor(public readonly messages: string[]) {
    super(messages.join('; '));
  }
}
