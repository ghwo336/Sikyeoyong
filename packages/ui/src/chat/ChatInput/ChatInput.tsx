'use client';

import { type KeyboardEvent, type SyntheticEvent, useId, useRef } from 'react';
import styles from './ChatInput.module.css';

export interface ChatInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Gets the trimmed text. Sending is the parent's job. */
  readonly onSend: (text: string) => void;
  readonly placeholder: string;
  /** While the last message is on its way: typing is fine, sending again is not. */
  readonly sending?: boolean;
  /** No typing or sending, e.g. while the dragon is stopped. */
  readonly disabled?: boolean;
  /** Shown under the field while disabled ("용이가 멈춰 있어요"). */
  readonly disabledNote?: string;
}

/** Draws the chat field and the send button (ChatInput.md). */
export function ChatInput({
  value,
  onChange,
  onSend,
  placeholder,
  sending = false,
  disabled = false,
  disabledNote,
}: ChatInputProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const text = value.trim();
  const canSend = text !== '' && !sending && !disabled;
  const showNote = disabled && disabledNote !== undefined && disabledNote !== '';

  function send() {
    if (canSend) onSend(text);
  }

  function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    send();
  }

  // Korean IME: the Enter that ends a composition must not send the half-typed word.
  // Safari sends that Enter right after compositionend, so the flag clears a tick later.
  const composing = useRef(false);
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && (composing.current || e.nativeEvent.isComposing)) {
      e.preventDefault();
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.row}>
        <label htmlFor={id} className={styles.srOnly}>
          용이에게 말하기
        </label>
        <input
          id={id}
          className={styles.input}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          enterKeyHint="send"
          autoComplete="off"
          aria-describedby={showNote ? noteId : undefined}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            setTimeout(() => {
              composing.current = false;
            }, 0);
          }}
        />
        <button
          type="submit"
          className={styles.send}
          aria-label="보내기"
          // The design keeps the circle leaf even when empty; only a stopped dragon greys it.
          disabled={disabled}
          aria-disabled={!canSend || undefined}
          aria-busy={sending || undefined}
        >
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5" />
            <path d="M6 11l6-6 6 6" />
          </svg>
        </button>
      </div>
      {showNote ? (
        <p id={noteId} className={styles.note}>
          {disabledNote}
        </p>
      ) : null}
    </form>
  );
}
