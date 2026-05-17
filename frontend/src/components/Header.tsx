import type { Currency, WalletState } from '../types';

interface Props {
  wallet: WalletState;
  ethPrice?: number;
  currency: Currency;
  onToggleCurrency: () => void;
}

function EthLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current text-fa-bright flex-shrink-0">
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
      style={{ borderBottom: '1px solid rgba(37,101,105,0.15)', background: 'rgba(245,249,249,0.92)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 grid grid-cols-3 items-center gap-2">

        {/* LEFT: логотип */}
        <div className="flex items-center gap-2.5 min-w-0">
          <EthLogo />
          <div className="leading-tight min-w-0">
            <span className="font-bold text-[#0f2424] tracking-tight">Артём Выродов</span>
            <span className="hidden md:block text-[11px] leading-none truncate" style={{ color: 'rgba(37,101,105,0.65)' }}>
              Сервис прогнозирования транзакционных издержек Ethereum
            </span>
          </div>
        </div>

        {/* CENTER: цена ETH + переключатель валюты */}
        <div className="flex justify-center">
          {ethPrice != null && (
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(37,101,105,0.2)' }}
            >
              <div
                className="flex items-center gap-2 px-3 py-1.5 text-sm"
                style={{ background: 'rgba(37,101,105,0.07)' }}
              >
                <span className="text-fa-dark text-xs font-medium">ETH</span>
                <span className="font-mono font-semibold text-[#0f2424] whitespace-nowrap">
                  {formatPrice(ethPrice, currency)}
                </span>
              </div>
              <button
                onClick={onToggleCurrency}
                className="px-2.5 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: 'rgba(37,101,105,0.10)',
                  color: '#256569',
                  borderLeft: '1px solid rgba(37,101,105,0.2)',
                }}
                title="Переключить валюту"
              >
                {currency === 'RUB' ? '₽' : '$'}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: кнопка кошелька + ошибка под ней */}
        <div className="flex flex-col items-end gap-1 min-w-0">
          <button
            onClick={account ? disconnect : connect}
            disabled={connecting}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 whitespace-nowrap"
            style={
              account
                ? { background: 'rgba(37,101,105,0.10)', border: '1px solid rgba(37,101,105,0.35)', color: '#256569' }
                : { background: 'linear-gradient(135deg, #256569, #355CA8)', color: '#fff', boxShadow: '0 2px 12px rgba(37,101,105,0.30)' }
            }
          >
            {connecting ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Подключение…
              </span>
            ) : short ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#256569' }} />
                {short}
              </span>
            ) : (
              'Подключить кошелёк'
            )}
          </button>

          {/* Ошибка — под кнопкой, не ломает строку */}
          {error && (
            <span
              className="text-[11px] leading-tight text-right max-w-[200px]"
              style={{ color: '#D80F16' }}
            >
              {error}
            </span>
          )}
        </div>

      </div>
    </header>
  );
}
