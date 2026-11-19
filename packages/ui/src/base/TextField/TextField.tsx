import { type HTMLAttributes, useId } from 'react';
import { ErrorLine } from '../ErrorLine';
import styles from './TextField.module.css';

export interface TextFieldProps {
  /** Visible label above the field ("이름"), tied with htmlFor. */
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  /** Message from the parent; the field only shows it (TextField.md). */
  readonly error?: string;
  /** One plain line under the field ("레벨 1로 태어나요. 한 번에 10,000원까지."). Stays with an error. */
  readonly hint?: string;
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
  hint,
  inputMode,
  maxLength,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hasError = error !== undefined && error !== '';
  const hasHint = hint !== undefined && hint !== '';
  const describedBy = [hasError ? errorId : '', hasHint ? hintId : ''].filter(Boolean).join(' ');
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
        aria-describedby={describedBy === '' ? undefined : describedBy}
        data-error={hasError || undefined}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
      {hasError ? <ErrorLine id={errorId}>{error}</ErrorLine> : null}
      {hasHint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
