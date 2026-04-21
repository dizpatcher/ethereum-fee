import type { WalletState } from '../types';

interface Props {
  wallet: WalletState;
  ethPrice?: number;
}

function EthLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current text-violet-400">
      <path d="M11.998 0L5 12.239l6.998 4.131 7-4.131L11.998 0zm0 16.37l-6.998-4.131 6.998 9.761 7.002-9.761-7.002 4.131z" />
    </svg>
  );
}

export default function Header({ wallet, ethPrice }: Props) {
  const { account, connecting, error, connect, disconnect } = wallet;
  const short = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : null;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <EthLogo />
          <div className="leading-tight">
            <span className="font-bold text-white tracking-tight">GasForecast</span>
            <span className="hidden sm:block text-[11px] text-white/40 leading-none">
              Ethereum Fee Predictor
            </span>
          </div>
        </div>

        {/* ETH Price */}
        {ethPrice != null && (
          <div className="hidden sm:flex items-center gap-2 glass-card px-3 py-1.5 text-sm">
            <span className="text-white/40">ETH</span>
            <span className="font-mono font-semibold text-white">
              $
              {ethPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {error && (
            <span className="hidden sm:inline text-xs text-rose-400 max-w-[200px] truncate">
              {error}
            </span>
          )}
          <button
            onClick={account ? disconnect : connect}
            disabled={connecting}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
              account
                ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20'
            }`}
          >
            {connecting ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Подключение…
              </span>
            ) : short ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
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
