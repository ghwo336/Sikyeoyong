import { type HTMLAttributes, useId } from 'react';
import styles from './TextField.module.css';

export interface TextFieldProps {
  /** Visible label above the field ("이름"), tied with htmlFor. */
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  /** Message from the parent; the field only shows it (TextField.md). */
  readonly error?: string;
  readonly inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  /** Name.dc.html caps the dragon name at 8. */
  readonly maxLength?: number;
}

/** Draws one labeled single-line field (TextField.md). Validation belongs to the parent. */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  inputMode,
  maxLength,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = error !== undefined && error !== '';
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        data-error={hasError || undefined}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
      {hasError ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
