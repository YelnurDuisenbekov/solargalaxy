import { Children, cloneElement, isValidElement, useId } from 'react';

export default function FormField({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  className = '',
}) {
  const autoId = useId();
  const fieldId = htmlFor || autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errId = error ? `${fieldId}-err` : undefined;
  const describedBy = (error ? errId : hintId) || undefined;

  const arr = Children.toArray(children);
  let content = children;
  if (arr.length === 1 && isValidElement(arr[0])) {
    const child = arr[0];
    const mergedDescribedBy = [child.props['aria-describedby'], describedBy]
      .filter(Boolean)
      .join(' ') || undefined;
    content = cloneElement(child, {
      id: child.props.id || fieldId,
      'aria-invalid': error ? true : child.props['aria-invalid'],
      'aria-describedby': mergedDescribedBy,
      required: required ?? child.props.required,
    });
  }

  return (
    <div className={`app-field${error ? ' app-field--error' : ''}${className ? ` ${className}` : ''}`}>
      {label && (
        <label htmlFor={fieldId}>
          {label}
          {required && <span className="app-field__req" aria-hidden="true"> *</span>}
        </label>
      )}
      {content}
      {hint && !error && <p id={hintId} className="app-field__hint">{hint}</p>}
      {error && <p id={errId} className="app-field__error" role="alert">{error}</p>}
    </div>
  );
}
