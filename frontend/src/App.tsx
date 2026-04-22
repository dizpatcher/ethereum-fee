import { useGasData } from './hooks/useGasData';
import { useWallet } from './hooks/useWallet';
import { useCurrency } from './hooks/useCurrency';
import Header from './components/Header';
import StatsRow from './components/StatsRow';
import PredictionGrid from './components/PredictionGrid';
import FeeChart from './components/FeeChart';
import TransactionEstimator from './components/TransactionEstimator';

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-10 h-10 border-2 border-fa-bright border-t-transparent rounded-full animate-spin" />
      <p className="text-white/40 text-sm">Загрузка данных Ethereum…</p>
    </div>
  );
}

export default function App() {
  const { data, loading, error } = useGasData(15_000);
  const wallet = useWallet();
  const { currency, toggle } = useCurrency();

  const ethPrice = data
    ? currency === 'RUB'
      ? data.eth_price_rub
      : data.eth_price_usd
    : undefined;

  return (
    <div className="min-h-screen bg-[#050d0e] text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
        <div className="absolute -top-72 -left-48 w-[600px] h-[600px] rounded-full blur-3xl"
             style={{ background: 'radial-gradient(circle, rgba(37,101,105,0.22) 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -right-48 w-[450px] h-[450px] rounded-full blur-3xl"
             style={{ background: 'radial-gradient(circle, rgba(53,92,168,0.14) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full blur-3xl"
             style={{ background: 'radial-gradient(circle, rgba(0,152,175,0.10) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header
          wallet={wallet}
          ethPrice={ethPrice}
          currency={currency}
          onToggleCurrency={toggle}
        />

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-20">
          {loading && !data && <Spinner />}

          {error && (
            <div className="mt-8 p-4 rounded-xl text-sm"
                 style={{ background: 'rgba(216,15,22,0.08)', border: '1px solid rgba(216,15,22,0.25)', color: '#ff6b70' }}>
              <strong>Ошибка подключения к API:</strong> {error}
              <p className="mt-1 text-xs opacity-60">
                Убедитесь, что бэкенд запущен:{' '}
                <code className="font-mono">uvicorn main:app --reload</code>
              </p>
            </div>
          )}

          {data && (
            <>
              <StatsRow
                current={data.current}
                ethPriceUsd={data.eth_price_usd}
                ethPriceRub={data.eth_price_rub}
                currency={currency}
                updatedAt={data.updated_at}
              />
              <PredictionGrid
                predictions={data.predictions}
                ethPriceUsd={data.eth_price_usd}
                ethPriceRub={data.eth_price_rub}
                currency={currency}
              />
              <FeeChart predictions={data.predictions} />
              <TransactionEstimator
                predictions={data.predictions}
                gasUnits={data.gas_units}
                ethPriceUsd={data.eth_price_usd}
                ethPriceRub={data.eth_price_rub}
                currency={currency}
                wallet={wallet}
              />
            </>
          )}
        </main>

        <footer className="border-t py-5" style={{ borderColor: 'rgba(0,152,175,0.12)' }}>
          <p className="text-center text-xs text-white/25">
            Артём Выродов, DevOps24-1м · ВКР · Прогнозирование транзакционных издержек цифровых валют с MLOps
          </p>
        </footer>
      </div>
    </div>
  );
}
