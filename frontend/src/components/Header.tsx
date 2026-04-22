import type { Currency, WalletState } from '../types';

interface Props {
  wallet: WalletState;
  ethPrice?: number;
  currency: Currency;
  onToggleCurrency: () => void;
}

function EthLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current text-fa-bright">
      <path d="M11.998 0L5 12.239l6.998 4.131 7-4.131L11.998 0zm0 16.37l-6.998-4.131 6.998 9.761 7.002-9.761-7.002 4.131z" />
    </svg>
  );
}

function formatPrice(price: number, currency: Currency) {
  if (currency === 'RUB') {
    return price.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
  }
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Header({ wallet, ethPrice, currency, onToggleCurrency }: Props) {
  const { account, connecting, error, connect, disconnect } = wallet;
  const short = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : null;

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{ borderBottom: '1px solid rgba(0,152,175,0.14)', background: 'rgba(5,13,14,0.75)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <EthLogo />
          <div className="leading-tight">
            <span className="font-bold text-white tracking-tight">GasForecast</span>
            <span className="hidden sm:block text-[11px] leading-none" style={{ color: 'rgba(0,152,175,0.7)' }}>
              Ethereum Fee Predictor
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ETH Price + переключатель валюты */}
          {ethPrice != null && (
            <div
              className="hidden sm:flex items-center rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(0,152,175,0.2)' }}
            >
              {/* Цена */}
              <div
                className="flex items-center gap-2 px-3 py-1.5 text-sm"
                style={{ background: 'rgba(37,101,105,0.15)' }}
              >
                <span className="text-fa-bright text-xs font-medium">ETH</span>
                <span className="font-mono font-semibold text-white">
                  {formatPrice(ethPrice, currency)}
                </span>
              </div>
              {/* Кнопка переключения */}
              <button
                onClick={onToggleCurrency}
                className="px-2.5 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: 'rgba(0,107,128,0.25)',
                  color: '#0098AF',
                  borderLeft: '1px solid rgba(0,152,175,0.2)',
                }}
                title="Переключить валюту"
              >
                {currency === 'RUB' ? '₽' : '$'}
              </button>
            </div>
          )}

          {/* Переключатель на мобиле (без цены) */}
          {ethPrice != null && (
            <button
              onClick={onToggleCurrency}
              className="sm:hidden px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: 'rgba(0,107,128,0.25)', border: '1px solid rgba(0,152,175,0.2)', color: '#0098AF' }}
            >
              {currency === 'RUB' ? '→ $' : '→ ₽'}
            </button>
          )}

          {error && (
            <span className="hidden sm:inline text-xs max-w-[200px] truncate" style={{ color: '#ff6b70' }}>
              {error}
            </span>
          )}

          {/* Кнопка кошелька */}
          <button
            onClick={account ? disconnect : connect}
            disabled={connecting}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
            style={
              account
                ? { background: 'rgba(0,107,128,0.18)', border: '1px solid rgba(0,152,175,0.35)', color: '#0098AF' }
                : { background: 'linear-gradient(135deg, #006B80, #0098AF)', color: '#fff', boxShadow: '0 0 18px -4px rgba(0,152,175,0.5)' }
            }
          >
            {connecting ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Подключение…
              </span>
            ) : short ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#0098AF' }} />
                {short}
              </span>
            ) : (
              'Подключить кошелёк'
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
