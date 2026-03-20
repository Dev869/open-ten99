import { formatCurrency } from '../../lib/utils';
import type { ClientRevenue } from '../../lib/finance';

interface TopClientsProps {
  clients: ClientRevenue[];
  maxClients?: number;
}

const barColors = ['var(--accent)', '#6366f1', '#D4873E', '#5A9A5A', '#888'];

export function TopClients({ clients, maxClients = 5 }: TopClientsProps) {
  const top = clients.slice(0, maxClients);
  const maxRevenue = top[0]?.revenue ?? 1;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-4">Top Clients</h3>
      <div className="space-y-3">
        {top.map((client, i) => (
          <div key={client.clientId}>
            <div className="flex justify-between text-xs mb-1">
              <span>{client.clientName}</span>
              <span style={{ color: barColors[i] ?? '#888' }}>{formatCurrency(client.revenue)}</span>
            </div>
            <div className="h-1 bg-[var(--border)] rounded-full">
              <div className="h-full rounded-full transition-all" style={{ width: `${(client.revenue / maxRevenue) * 100}%`, background: barColors[i] ?? '#888' }} />
            </div>
          </div>
        ))}
        {clients.length === 0 && <p className="text-xs text-[var(--text-secondary)]">No revenue data yet</p>}
      </div>
    </div>
  );
}
