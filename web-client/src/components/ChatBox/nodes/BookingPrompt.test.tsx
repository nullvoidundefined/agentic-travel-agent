import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BookingPrompt } from './BookingPrompt';

afterEach(cleanup);

describe('BookingPrompt', () => {
  it('renders Book now and Change something chips when both empty flags are false', () => {
    render(
      <BookingPrompt
        experiencesEmpty={false}
        carRentalsEmpty={false}
        onBookNow={() => {}}
        onQuickReply={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Book now' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change something' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add experiences' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add car rental' }),
    ).not.toBeInTheDocument();
  });

  it('renders Add experiences chip only when experiencesEmpty is true', () => {
    render(
      <BookingPrompt
        experiencesEmpty
        carRentalsEmpty={false}
        onBookNow={() => {}}
        onQuickReply={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Add experiences' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add car rental' }),
    ).not.toBeInTheDocument();
  });

  it('renders all four chips when both empty flags are true', () => {
    render(
      <BookingPrompt
        experiencesEmpty
        carRentalsEmpty
        onBookNow={() => {}}
        onQuickReply={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Book now' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add experiences' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add car rental' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change something' }),
    ).toBeInTheDocument();
  });

  it('calls onBookNow when Book now is clicked', () => {
    const onBookNow = vi.fn();
    render(
      <BookingPrompt
        experiencesEmpty={false}
        carRentalsEmpty={false}
        onBookNow={onBookNow}
        onQuickReply={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Book now' }));
    expect(onBookNow).toHaveBeenCalledTimes(1);
  });

  it('calls onQuickReply with the correct prompt for Change something', () => {
    const onQuickReply = vi.fn();
    render(
      <BookingPrompt
        experiencesEmpty={false}
        carRentalsEmpty={false}
        onBookNow={() => {}}
        onQuickReply={onQuickReply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Change something' }));
    expect(onQuickReply).toHaveBeenCalledWith(
      "I'd like to make some changes to the itinerary. What would you suggest adjusting?",
    );
  });

  it('calls onQuickReply with the experiences prompt for Add experiences', () => {
    const onQuickReply = vi.fn();
    render(
      <BookingPrompt
        experiencesEmpty
        carRentalsEmpty={false}
        onBookNow={() => {}}
        onQuickReply={onQuickReply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add experiences' }));
    expect(onQuickReply).toHaveBeenCalledWith(
      'Can you suggest some experiences for this trip?',
    );
  });

  it('calls onQuickReply with the car rental prompt for Add car rental', () => {
    const onQuickReply = vi.fn();
    render(
      <BookingPrompt
        experiencesEmpty={false}
        carRentalsEmpty
        onBookNow={() => {}}
        onQuickReply={onQuickReply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add car rental' }));
    expect(onQuickReply).toHaveBeenCalledWith(
      'Can you find a car rental for this trip?',
    );
  });
});
