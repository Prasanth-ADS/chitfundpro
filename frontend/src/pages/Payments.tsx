import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { PaymentEntryModal } from '../components/PaymentEntryModal';
import { Activity, Banknote, Landmark, Smartphone } from 'lucide-react';

export function Payments() {
  const queryClient = useQueryClient();
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const { data: pools } = useQuery({
    queryKey: ['pools'],
    queryFn: async () => {
      const res = await api.get('/api/pools');
      return res.data;
    }
  });

  const { data: summary } = useQuery({
    queryKey: ['daily-summary'],
    queryFn: async () => {
      const res = await api.get('/api/payments/summary/daily');
      return res.data;
    }
  });

  const selectedPool = pools?.find((p: any) => p.id === selectedPoolId);

  const { data: membersStatus, isLoading } = useQuery({
    queryKey: ['pool-payments', selectedPoolId, selectedPool?.currentMonth],
    queryFn: async () => {
      const res = await api.get(`/api/payments/pool/${selectedPoolId}/month/${selectedPool?.currentMonth || 1}`);
      return res.data;
    },
    enabled: !!selectedPoolId
  });

  const quickPayMutation = useMutation({
    mutationFn: async (member: any) => {
      await api.post('/api/payments', {
        enrollmentId: member.enrollmentId,
        month: selectedPool?.currentMonth,
        amountDue: member.amountDue,
        amountPaid: member.amountDue,
        lateFee: 0,
        paymentMode: 'CASH',
        status: 'PAID',
        notes: 'Quick Pay',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-payments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
    }
  });

  const filteredMembers = membersStatus?.filter((m: any) => showUnpaidOnly ? m.status === 'UNPAID' : true);
  const totalPaid = membersStatus?.filter((m: any) => m.status === 'PAID' || m.status === 'PARTIAL' || m.status === 'ADVANCE').length || 0;
  const totalSlots = membersStatus?.length || 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Monthly Payments</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Activity className="h-4 w-4" /> Today's Collection</p>
          <div className="text-2xl font-bold mt-2">₹{(summary?.TOTAL || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Banknote className="h-4 w-4" /> Cash</p>
          <div className="text-2xl font-bold mt-2">₹{(summary?.CASH || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Smartphone className="h-4 w-4" /> UPI</p>
          <div className="text-2xl font-bold mt-2">₹{(summary?.UPI || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Landmark className="h-4 w-4" /> Bank</p>
          <div className="text-2xl font-bold mt-2">₹{(summary?.BANK || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <select 
              className="flex h-10 w-full md:w-64 rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedPoolId} 
              onChange={e => setSelectedPoolId(e.target.value)}
            >
              <option value="">Select Pool</option>
              {pools?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} (Month {p.currentMonth})</option>
              ))}
            </select>
            {selectedPoolId && (
              <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
                <input type="checkbox" checked={showUnpaidOnly} onChange={e => setShowUnpaidOnly(e.target.checked)} className="rounded border-gray-300 h-4 w-4" />
                Show Unpaid Only
              </label>
            )}
          </div>
          {selectedPoolId && (
            <div className="flex items-center gap-4 w-full md:w-1/3">
              <div className="text-sm text-right whitespace-nowrap"><span className="font-bold">{totalPaid}</span> of {totalSlots} members paid</div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${(totalPaid / (totalSlots || 1)) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        {!selectedPoolId && (
          <div className="text-center py-12 text-muted-foreground">Select a pool to track this month's payments.</div>
        )}

        {selectedPoolId && isLoading && <div className="p-4">Loading members...</div>}

        {selectedPoolId && !isLoading && (
          <div className="rounded-xl border bg-background overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="py-3 px-4 font-medium">Slot #</th>
                  <th className="py-3 px-4 font-medium">Member Name</th>
                  <th className="py-3 px-4 font-medium text-right">Amount Due</th>
                  <th className="py-3 px-4 font-medium text-center">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers?.map((m: any) => (
                  <tr key={m.enrollmentId} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-muted-foreground">#{m.slotNumber}</td>
                    <td className="py-3 px-4 font-semibold flex items-center gap-2">
                      {m.memberName}
                      {m.riskLevel === 'Low' && <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-100 text-green-800 border border-green-200" title={m.riskReason}>Low Risk</span>}
                      {m.riskLevel === 'Medium' && <span className="px-1.5 py-0.5 text-[10px] rounded bg-yellow-100 text-yellow-800 border border-yellow-200" title={m.riskReason}>Med Risk</span>}
                      {m.riskLevel === 'High' && <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-800 border border-red-200" title={m.riskReason}>High Risk</span>}
                    </td>
                    <td className="py-3 px-4 text-right">₹{m.amountDue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      {m.status === 'UNPAID' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">UNPAID</span>}
                      {m.status === 'PAID' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">PAID</span>}
                      {m.status === 'PARTIAL' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">PARTIAL (₹{m.amountPaid})</span>}
                      {m.status === 'ADVANCE' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">ADVANCE</span>}
                    </td>
                    <td className="py-3 px-4 space-x-2 text-right">
                      {m.status === 'UNPAID' && (
                        <Button size="sm" onClick={() => quickPayMutation.mutate(m)} disabled={quickPayMutation.isPending}>Quick Pay</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setSelectedMember(m)}>Details</Button>
                    </td>
                  </tr>
                ))}
                {filteredMembers?.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">All caught up!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaymentEntryModal 
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        memberData={selectedMember}
        month={selectedPool?.currentMonth}
      />
    </div>
  );
}
