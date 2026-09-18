import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('mostra il titolo della home', async () => {
    render(<App />);
    expect(await screen.findByText('Scouting Pallavolo')).toBeInTheDocument();
  });
});
