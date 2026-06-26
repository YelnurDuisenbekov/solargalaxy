import { useEffect, useState } from 'react';
import {
  clampDecimal,
  commitOnEnterKey,
  formatDecimalValue,
  parseDecimalInput,
  sanitizeDecimalTyping,
} from '../../utils/constructor/decimalInput.js';

/** Текстовое поле числа: правка локально, применение по Enter и при blur */
export default function DecimalField({
  value,
  onCommit,
  min,
  max,
  decimals = null,
  className,
  disabled,
  title,
  placeholder,
}) {
  const [draft, setDraft] = useState(() => formatDecimalValue(value, decimals));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(formatDecimalValue(value, decimals));
    }
  }, [value, focused, decimals]);

  const commit = () => {
    const parsed = parseDecimalInput(draft);
    if (parsed == null) {
      setDraft(formatDecimalValue(value, decimals));
      setFocused(false);
      return;
    }
    const next = clampDecimal(parsed, min, max, decimals);
    onCommit?.(next);
    setFocused(false);
  };

  const cancel = () => {
    setDraft(formatDecimalValue(value, decimals));
    setFocused(false);
  };

  const classes = ['decimal-field', className].filter(Boolean).join(' ');

  return (
    <input
      type="text"
      inputMode="decimal"
      className={classes}
      value={draft}
      disabled={disabled}
      title={title}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onChange={(e) => setDraft(sanitizeDecimalTyping(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          cancel();
          e.currentTarget.blur();
          return;
        }
        commitOnEnterKey(e, commit);
      }}
      onBlur={commit}
    />
  );
}
