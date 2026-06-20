import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('GFM-táblát renderel', () => {
    render(<Markdown szoveg={'| A | B |\n| --- | --- |\n| 1 | 2 |'} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('a melleklet:ID képet jelöléssel mutatja (nem tört képként)', () => {
    render(<Markdown szoveg={'![Űrlap](melleklet:M2)'} />);
    expect(screen.getByText(/melléklet:/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
