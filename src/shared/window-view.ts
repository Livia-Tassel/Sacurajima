export type WindowView = 'companion' | 'panel';

export function parseWindowView(search: string): WindowView {
  const params = new URLSearchParams(search);
  return params.get('view') === 'companion' ? 'companion' : 'panel';
}

