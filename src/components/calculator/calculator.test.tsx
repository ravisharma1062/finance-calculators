import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadMessages } from '@/i18n/messages';
import { CalculatorClient } from './CalculatorClient';
import { InputSlider } from './InputSlider';
import { ModeTabs } from './ModeTabs';

vi.mock('./BalanceChart', () => ({ default: () => <div data-testid="chart" /> }));
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = () => <div data-testid="chart" />;
    return Stub;
  },
}));

let messages: Record<string, unknown>;
beforeAll(async () => {
  messages = await loadMessages('en-in');
});
afterEach(cleanup);

function Wrap({ children, locale = 'en-in' }: { children: ReactNode; locale?: string }) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages as never}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('InputSlider', () => {
  function Harness({ initial = 50 }: { initial?: number }) {
    const [v, setV] = useState(initial);
    return <InputSlider label="Rate" value={v} onChange={setV} min={0} max={100} step={1} suffix="%" />;
  }

  it('keeps the slider and the number field in sync', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const number = screen.getByRole('spinbutton', { name: 'Rate' });
    const slider = screen.getByRole('slider', { name: 'Rate' });
    expect(number).toHaveValue(50);
    expect(slider).toHaveValue('50');

    await user.clear(number);
    await user.type(number, '75');
    expect(slider).toHaveValue('75');

    fireEvent.change(slider, { target: { value: '20' } });
    expect(number).toHaveValue(20);
  });

  it('clamps the slider when the typed number is outside its range', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const number = screen.getByRole('spinbutton', { name: 'Rate' });
    await user.clear(number);
    await user.type(number, '500');
    expect(number).toHaveValue(500);
    expect(screen.getByRole('slider')).toHaveValue('100');
  });

  it('reports an empty field as NaN and shows the error and hint', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <InputSlider
        label="Rate"
        value={5}
        onChange={onChange}
        min={0}
        max={10}
        step={1}
        error="Enter a number."
        hint="Helpful"
      />,
    );
    const number = screen.getByRole('spinbutton');
    await user.clear(number);
    expect(onChange).toHaveBeenLastCalledWith(NaN);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number.');
    expect(number).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Helpful')).toBeInTheDocument();
  });
});

describe('ModeTabs', () => {
  it('selects with click and arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ModeTabs
        label="Mode"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'C' }));
    expect(onChange).toHaveBeenLastCalledWith('c');
    screen.getByRole('tab', { name: 'A' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('b');
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('a');
  });
});

describe('CalculatorClient (SWP)', () => {
  const setup = () => render(<CalculatorClient slug="swp" />, { wrapper: Wrap });
  const corpusInput = () => screen.getByRole('spinbutton', { name: 'Total investment (corpus)' });

  it('shows results for the default inputs', async () => {
    setup();
    await waitFor(() => expect(screen.getByTestId('card-moneyLasts')).toBeInTheDocument());
    expect(screen.getByTestId('card-invested')).toHaveTextContent('₹20,00,000');
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument();
  });

  it('recalculates when the corpus changes, and shows the early-end warning', async () => {
    const user = userEvent.setup();
    setup();
    await user.clear(corpusInput());
    await user.type(corpusInput(), '100000');
    await waitFor(() => expect(screen.getByRole('list', { name: 'Warnings' })).toHaveTextContent(/Your money lasts/));
    await waitFor(() => expect(screen.getByTestId('card-invested')).toHaveTextContent('₹1,00,000'));
  });

  it('shows no warning when the money lasts for the whole period', async () => {
    const user = userEvent.setup();
    setup();
    await user.clear(corpusInput());
    await user.type(corpusInput(), '90000000');
    await waitFor(() => expect(screen.getByTestId('card-invested')).toHaveTextContent('₹9,00,00,000'));
    expect(screen.queryByText(/Your money lasts \d+ years/)).not.toBeInTheDocument();
  });

  it('shows an error message and hides results for invalid input', async () => {
    const user = userEvent.setup();
    setup();
    await user.clear(corpusInput());
    await waitFor(() => expect(screen.getByText('Enter a number.')).toBeInTheDocument());
    expect(screen.getByText(/fix the highlighted inputs/i)).toBeInTheDocument();
    expect(screen.queryByTestId('card-invested')).not.toBeInTheDocument();

    await user.type(corpusInput(), '0');
    await waitFor(() => expect(screen.getByText('Must be at least ₹1.')).toBeInTheDocument());
  });

  it('switches mode and hides inputs that are not needed', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByRole('spinbutton', { name: 'Total investment (corpus)' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Find the corpus' }));
    await waitFor(() =>
      expect(screen.queryByRole('spinbutton', { name: 'Total investment (corpus)' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByTestId('card-requiredCorpus')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Find the withdrawal' }));
    await waitFor(() =>
      expect(screen.queryByRole('spinbutton', { name: 'Withdrawal each period' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByTestId('card-withdrawalPerPeriod')).toBeInTheDocument());
  });

  it('switches between the plan-year, calendar-year and withdrawal tables', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calendar years' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Calendar years' }));
    expect(screen.getByRole('heading', { name: 'Calendar years' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Each withdrawal' }));
    const region = screen.getByRole('region', { name: 'Each withdrawal' });
    expect(within(region).getAllByRole('row').length).toBeGreaterThan(50);
  });

  it('short numbers toggle changes the format', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByTestId('card-invested')).toHaveTextContent('₹20,00,000'));
    await user.click(screen.getByLabelText('Short numbers'));
    expect(screen.getByTestId('card-invested')).toHaveTextContent('₹20 L');
  });

  it('reset restores the defaults', async () => {
    const user = userEvent.setup();
    setup();
    await user.clear(corpusInput());
    await user.type(corpusInput(), '123456');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(corpusInput()).toHaveValue(2_000_000));
  });

  it('restores inputs from the share link', async () => {
    window.history.replaceState(null, '', '/en-in/calculators/swp/?corpus=3500000&mode=keep');
    setup();
    await waitFor(() => expect(corpusInput()).toHaveValue(3_500_000));
    expect(screen.getByRole('tab', { name: 'Keep the principal' })).toHaveAttribute('aria-selected', 'true');
    window.history.replaceState(null, '', '/');
  });

  it('writes the changed inputs to the address', async () => {
    window.history.replaceState(null, '', '/en-in/calculators/swp/');
    const user = userEvent.setup();
    setup();
    await user.clear(corpusInput());
    await user.type(corpusInput(), '4000000');
    await waitFor(() => expect(window.location.search).toContain('corpus=4000000'), { timeout: 2000 });
    window.history.replaceState(null, '', '/');
  });

  it('copies the share link', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    await user.click(screen.getByRole('button', { name: 'Share link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument();
  });
});

describe('CalculatorClient (other calculators)', () => {
  it('formats US amounts in dollars', async () => {
    render(<CalculatorClient slug="emi" />, { wrapper: ({ children }) => <Wrap locale="en-us">{children}</Wrap> });
    await waitFor(() => expect(screen.getByTestId('card-emi')).toHaveTextContent('$'));
    expect(screen.getByTestId('card-loanAmount')).toHaveTextContent('$');
  });

  it('shows a cross-field error for the FIRE ages', async () => {
    const user = userEvent.setup();
    render(<CalculatorClient slug="fire" />, { wrapper: Wrap });
    const retire = screen.getByRole('spinbutton', { name: 'Retirement age' });
    await user.clear(retire);
    await user.type(retire, '20');
    await waitFor(() =>
      expect(screen.getByText('Retirement age must be higher than your age now.')).toBeInTheDocument(),
    );
  });

  it('shows the PPF limit warning only above the limit', async () => {
    const user = userEvent.setup();
    render(<CalculatorClient slug="ppf" />, { wrapper: Wrap });
    const dep = screen.getByRole('spinbutton', { name: 'Yearly deposit' });
    await user.clear(dep);
    await user.type(dep, '140000');
    await waitFor(() => expect(screen.getByTestId('card-maturity')).toBeInTheDocument());
    expect(screen.queryByText(/yearly limit/)).not.toBeInTheDocument();
    await user.clear(dep);
    await user.type(dep, '200000');
    await waitFor(() => expect(screen.getByText(/yearly limit for this scheme is ₹1,50,000/)).toBeInTheDocument());
  });
});
