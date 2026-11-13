export interface ConfirmationOptions {
  locale?: string; title?: string; confirmLabel?: string; cancelLabel?: string;
  confirmAction?: string; cancelAction?: string;
}
export function confirmAction(document: Document, message: string, options?: ConfirmationOptions): Promise<boolean>;
export function cancelConfirmation(document: Document): void;
