import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type Currency = 'USD' | 'CHF';

interface CurrencyContextType {
  currency: Currency;
  exchangeRate: number;
  isLoading: boolean;
  toggleCurrency: () => void;
  setCurrency: (currency: Currency) => void;
  formatCurrency: (amount: number) => string;
  convertAmount: (amount: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  CHF: 'CHF ',
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('currency');
    return saved === 'CHF' ? 'CHF' : 'USD';
  });
  const [exchangeRate, setExchangeRate] = useState<number>(0.90); // Default fallback
  const [isLoading, setIsLoading] = useState(true);

  // Fetch exchange rate on mount
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=CHF');
        const data = await response.json();
        if (data.rates?.CHF) {
          setExchangeRate(data.rates.CHF);
          localStorage.setItem('exchangeRate', String(data.rates.CHF));
          localStorage.setItem('exchangeRateDate', new Date().toISOString());
        }
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
        // Try to use cached rate
        const cached = localStorage.getItem('exchangeRate');
        if (cached) {
          setExchangeRate(parseFloat(cached));
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Check if we have a recent cached rate (less than 24 hours old)
    const cachedDate = localStorage.getItem('exchangeRateDate');
    const cachedRate = localStorage.getItem('exchangeRate');
    if (cachedDate && cachedRate) {
      const age = Date.now() - new Date(cachedDate).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        setExchangeRate(parseFloat(cachedRate));
        setIsLoading(false);
        return;
      }
    }

    fetchExchangeRate();
  }, []);

  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
  }, []);

  const toggleCurrency = useCallback(() => {
    setCurrencyState(prev => prev === 'USD' ? 'CHF' : 'USD');
  }, []);

  const convertAmount = useCallback((amount: number): number => {
    if (currency === 'USD') return amount;
    return amount * exchangeRate;
  }, [currency, exchangeRate]);

  const formatCurrency = useCallback((amount: number): string => {
    const converted = convertAmount(amount);
    const symbol = CURRENCY_SYMBOLS[currency];

    if (currency === 'CHF') {
      return `${symbol}${converted.toFixed(2)}`;
    }
    return `${symbol}${converted.toFixed(2)}`;
  }, [currency, convertAmount]);

  return (
    <CurrencyContext.Provider value={{
      currency,
      exchangeRate,
      isLoading,
      toggleCurrency,
      setCurrency,
      formatCurrency,
      convertAmount,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
