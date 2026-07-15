import { PortfolioEditor } from './portfolio-editor.js?v=0.2.3-phase-3b-2';

export function initPortfolioPhase3B(options = {}) {
  const root = document.querySelector('[data-portfolio-editor]');
  if (!root) return null;
  return new PortfolioEditor(root, options).mount();
}
