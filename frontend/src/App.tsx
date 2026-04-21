import { useGasData } from './hooks/useGasData';
import { useWallet } from './hooks/useWallet';
import Header from './components/Header';
import StatsRow from './components/StatsRow';
import PredictionGrid from './components/PredictionGrid';
import FeeChart from './components/FeeChart';
import TransactionEstimator from './components/TransactionEstimator';

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-white/40 text-sm">Загрузка данных Ethereum…</p>
    </div>
  );
}

export default function App() {
  const { data, loading, error } = useGasData(15_000);
  const wallet = useWallet();

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
        <div className="absolute -top-60 -left-60 w-[500px] h-[500px] bg-violet-700/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-700/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-700/[0.08] rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header wallet={wallet} ethPrice={data?.eth_price} />

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-20">
          {loading && !data && <Spinner />}

          {error && (
            <div className="mt-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <strong>Ошибка подключения к API:</strong> {error}
              <p className="mt-1 text-rose-400/60 text-xs">
                Убедитесь, что бэкенд запущен:{' '}
                <code className="font-mono">uvicorn main:app --reload</code>
              </p>
            </div>
          )}

          {data && (
            <>
              <StatsRow
                current={data.current}
                ethPrice={data.eth_price}
                updatedAt={data.updated_at}
              />
              <PredictionGrid predictions={data.predictions} />
              <FeeChart predictions={data.predictions} />
              <TransactionEstimator
                predictions={data.predictions}
                gasUnits={data.gas_units}
                ethPrice={data.eth_price}
                wallet={wallet}
              />
            </>
          )}
        </main>

        <footer className="border-t border-white/[0.05] py-5">
          <p className="text-center text-xs text-white/20">
            Артём Выродов, DevOps24-1м · ВКР · Прогнозирование транзакционных издержек цифровых валют с MLOps
          </p>
        </footer>
      </div>
    </div>
  );
}
