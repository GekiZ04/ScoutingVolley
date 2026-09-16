import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('mostra il titolo della home', () => {
    render(<App />);
    expect(screen.getByText('Scouting Pallavolo')).toBeInTheDocument();
  });
});
