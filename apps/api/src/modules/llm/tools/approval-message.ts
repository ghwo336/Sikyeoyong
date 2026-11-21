/**
 * The model's free "message" on an approval request is shown to the owner on the approval
 * card, so it is one more place injected text could speak to a person. Only short plain
 * delivery talk passes: a link, a chain-style address, a code fence, a long digit run or a
 * markup tag drops the whole message. The server's reason and the order lines stay.
 */
const UNSAFE = /https?:\/\/|www\.|0x[0-9a-fA-F]{8,}|`|<[^>]*>|\d{9,}/;

export function cleanApprovalMessage(message: string | undefined): string | undefined {
  if (message === undefined) return undefined;
  const text = message.trim();
  if (text === '' || UNSAFE.test(text)) return undefined;
  return text;
}
