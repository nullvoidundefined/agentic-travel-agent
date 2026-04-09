import { get } from '@/lib/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TripDetailPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'trip-1' }),
}));

vi.mock('@/lib/api', () => ({
  get: vi.fn().mockResolvedValue({
    trip: {
      id: 'trip-1',
      destination: 'Beijing',
      origin: 'SFO',
      departure_date: '2026-08-01',
      return_date: '2026-08-08',
      budget_total: 10000,
      budget_currency: 'USD',
      travelers: 1,
      status: 'planning',
      flights: [
        {
          id: 'f1',
          origin: 'SFO',
          destination: 'PEK',
          airline: 'Asiana',
          flight_number: 'OZ211',
          price: 1010,
          currency: 'USD',
          departure_time: '2026-08-01T18:30:00',
        },
      ],
      hotels: [
        {
          id: 'h1',
          name: 'Hotel A',
          city: 'Beijing',
          price_per_night: 158,
          total_price: 1105,
          currency: 'USD',
          check_in: '2026-08-01',
          check_out: '2026-08-08',
        },
      ],
      // B1 reproduction: total_price arrives as NaN (e.g., the result
      // of parseFloat on a non-numeric pg NUMERIC string before the
      // boundary parser is registered, or from a corrupt row). The
      // current carRentalTotal reducer does not guard against this,
      // so NaN propagates into allocated and remaining and the UI
      // renders "$NaN".
      car_rentals: [
        {
          id: 'cr1',
          provider: 'Hertz',
          car_name: 'Toyota',
          car_type: 'compact',
          total_price: Number.NaN as unknown as number,
          currency: 'USD',
        },
      ],
      experiences: [],
    },
  }),
  put: vi.fn(),
}));

vi.mock('@/components/ChatBox/ChatBox', () => ({
  ChatBox: () => <div>chat</div>,
}));
vi.mock('@/components/BookingConfirmation/BookingConfirmation', () => ({
  BookingConfirmation: () => null,
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TripDetailPage />
    </QueryClientProvider>,
  );
}

describe('TripDetailPage budget rendering - string prices (B12 regression)', () => {
  it('shows correct allocated amount when prices arrive as strings (pg type parser not applied)', async () => {
    // Simulate pg NUMERIC returning as strings before the global type parser runs.
    // String concat: 0 + "1606" = "01606", which makes Number.isFinite fail and
    // allocated collapses to $0 even though Cost Breakdown shows the correct line items.
    vi.mocked(get).mockResolvedValueOnce({
      trip: {
        id: 'trip-1',
        destination: 'Beijing',
        origin: 'SFO',
        departure_date: '2026-08-01',
        return_date: '2026-08-08',
        budget_total: 10000,
        budget_currency: 'USD',
        travelers: 1,
        status: 'planning',
        flights: [
          {
            id: 'f1',
            origin: 'SFO',
            destination: 'PEK',
            airline: 'Asiana',
            flight_number: 'OZ211',
            price: '1606' as unknown as number,
            currency: 'USD',
            departure_time: null,
          },
        ],
        hotels: [
          {
            id: 'h1',
            name: 'Hotel A',
            city: 'Beijing',
            price_per_night: '150' as unknown as number,
            total_price: '225' as unknown as number,
            currency: 'USD',
            check_in: null,
            check_out: null,
          },
        ],
        car_rentals: [],
        experiences: [],
      },
    });
    renderPage();
    // $1,606 + $225 = $1,831 allocated
    const allocatedEl = await screen.findByText(/allocated/);
    expect(allocatedEl.textContent).toContain('1,831');
  });
});

describe('TripDetailPage budget rendering (B1 regression)', () => {
  it('never renders $NaN in the Budget tile when a car rental row has null total_price', async () => {
    renderPage();
    expect(await screen.findByText(/allocated/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('never renders $NaN in the Cost Breakdown Remaining row', async () => {
    renderPage();
    expect(await screen.findByText(/Remaining/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NaN');
  });
});
