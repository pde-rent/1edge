// @ts-nocheck
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';

/**
 * StrategyControls displays a list of strategies and allows starting/stopping them.
 */
export default function StrategyControls() {
  const { data, error, mutate } = useSWR('/api/config', fetcher);

  if (error) return <section><h2>Strategies</h2><p>Error loading strategies.</p></section>;
  if (!data) return <section><h2>Strategies</h2><p>Loading strategies...</p></section>;
  if (!data.success) return <section><h2>Strategies</h2><p>Error: {data.error}</p></section>;

  const strategies = data.data.strategies ? Object.values(data.data.strategies) : [];

  /**
   * Handles starting or stopping a strategy by ID.
   * @param id - The strategy ID.
   * @param action - The action to perform ('start' or 'stop').
   */
  const handleAction = async (id: string, action: 'start' | 'stop') => {
    try {
      await fetch(`/api/strategy/${id}/${action}`, { method: 'POST' });
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section>
      <h2>Strategies</h2>
      <ul>
        {strategies.map((strat: any) => (
          <li key={strat.id}>
            {strat.id} ({strat.symbol})
            <button onClick={() => handleAction(strat.id, 'start')}>Start</button>
            <button onClick={() => handleAction(strat.id, 'stop')}>Stop</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
