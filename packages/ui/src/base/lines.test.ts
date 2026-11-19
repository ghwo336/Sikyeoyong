import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { lines } from './lines';

describe('lines', () => {
  it('puts a <br> between lines and keeps every word', () => {
    const { container } = render(createElement('p', null, lines('배달은\n용이한테 시켜용')));
    expect(container.querySelectorAll('br')).toHaveLength(1);
    expect(container.textContent).toBe('배달은용이한테 시켜용');
  });

  it('draws one line without a <br>', () => {
    const { container } = render(createElement('p', null, lines('알이 흔들려용...')));
    expect(container.querySelectorAll('br')).toHaveLength(0);
    expect(container.textContent).toBe('알이 흔들려용...');
  });
});
