export function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.className) element.className = options.className;
  if (options.id) element.id = options.id;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.type) element.type = options.type;
  if (options.name) element.name = options.name;
  if (options.value !== undefined) element.value = options.value;
  if (options.placeholder) element.placeholder = options.placeholder;
  if (options.ariaLabel) element.setAttribute('aria-label', options.ariaLabel);
  if (options.role) element.setAttribute('role', options.role);
  if (options.hidden) element.hidden = true;
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      element.dataset[key] = value;
    });
  }

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      if (value === true) element.setAttribute(key, '');
      else if (value !== false && value !== null && value !== undefined) element.setAttribute(key, String(value));
    });
  }

  if (options.children) {
    options.children.forEach((child) => {
      if (child !== null && child !== undefined) {
        element.append(child);
      }
    });
  }

  return element;
}

export function createField({ label, input, hint }) {
  const id = input.id || `field-${Math.random().toString(36).slice(2)}`;
  input.id = id;

  const labelElement = createElement('label', {
    className: 'setup-field__label',
    text: label,
    attributes: { for: id }
  });

  const children = [labelElement, input];

  if (hint) {
    children.push(createElement('p', { className: 'setup-field__hint', text: hint }));
  }

  return createElement('div', {
    className: 'setup-field',
    children
  });
}

export function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(numeric);
}
