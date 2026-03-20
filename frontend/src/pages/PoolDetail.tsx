import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Clock, Lock, ShieldAlert, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { Button } from '../components/ui/button';

export function PoolDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: pool, isLoading } = useQuery({
    queryKey: ['pool', id],
    queryFn: async () => {
      const res = await axios.get(`http://localhost:5000/api/pools/${id}`, { withCredentials: true });
      return res.data;
    }
  });

  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [potNotes, setPotNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState('BANK');
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideRecipientId, setOverrideRecipientId] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestedMemberId: string; reason: string } | null>(null);

  const getAiSuggestion = async () => {
    setIsAiLoading(true);
    setAiSuggestion(null);
    try {
      const res = await axios.get(`http://localhost:5000/api/ai/pot-suggestion/${id}`, { withCredentials: true });
      setAiSuggestion(res.data);
    } catch (error) {
      console.error('Failed to get AI target:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const assignPotMutation = useMutation({
    mutationFn: async ({ amount, month }: any) => {
      await axios.post('http://localhost:5000/api/pots', {
        poolId: id,
        month,
        enrollmentId: selectedRecipientId,
        potAmount: amount,
        paymentMode,
        notes: potNotes
      }, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool', id] });
      setSelectedRecipientId('');
      setPotNotes('');
      setPaymentMode('BANK');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error assigning pot');
    }
  });

  const overrideMutation = useMutation({
    mutationFn: async ({ assignmentId, enrollmentId, notes }: any) => {
      await axios.put(`http://localhost:5000/api/pots/${assignmentId}`, {
        enrollmentId,
        notes
      }, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool', id] });
      setOverrideId(null);
      setOverrideRecipientId('');
      setOverrideNotes('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error overriding assignment');
    }
  });

  if (isLoading) return <div className="p-4">Loading pool details...</div>;
  if (!pool) return <div className="p-4">Pool not found</div>;

  const potAssignments: any[] = pool.potAssignments || [];
  const numberOfMonths = pool.scheme.numberOfMonths || 20;
  const months = Array.from({ length: numberOfMonths }, (_, i) => i + 1);
  const payoutSchedule = typeof pool.scheme.payoutSchedule === 'string'
    ? JSON.parse(pool.scheme.payoutSchedule)
    : pool.scheme.payoutSchedule;
  const paymentSchedule = typeof pool.scheme.paymentSchedule === 'string'
    ? JSON.parse(pool.scheme.paymentSchedule)
    : pool.scheme.paymentSchedule;

  // Eligible members = enrolled but have not received pot
  const eligibleMembers = (pool.enrollments || []).filter((e: any) => !e.potReceived);

  // For override: all enrolled members minus the current assignee
  const getOverrideEligible = (currentEnrollmentId: string) => {
    return (pool.enrollments || []).filter((e: any) => !e.potReceived || e.id === currentEnrollmentId);
  };

  // Current month pot info
  const currentPotAssignment = potAssignments.find((p: any) => p.month === pool.currentMonth);
  const currentPotAmount = payoutSchedule?.find((s: any) => s.month === pool.currentMonth)?.potAmount || 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/pools" className="p-2 hover:bg-muted rounded-full transition">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{pool.name}</h1>
          <p className="text-muted-foreground mt-1">
            Scheme: <span className="font-medium text-foreground">{pool.scheme.name}</span> | 
            Started: <span className="font-medium text-foreground">{new Date(pool.startDate).toLocaleDateString()}</span> |
            Current Month: <span className="font-medium text-foreground">{pool.currentMonth}</span>
          </p>
        </div>
      </div>

      {/* Visual Timeline */}
      <div className="mt-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-6">{numberOfMonths}-Month Timeline</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {months.map(month => {
            const assignment = potAssignments.find((p: any) => p.month === month);
            const isAssigned = !!assignment;
            const isCurrent = month === pool.currentMonth;
            const isPending = !isAssigned && !isCurrent;

            const payment = paymentSchedule?.find((p: any) => p.month === month);
            const payout = payoutSchedule?.find((p: any) => p.month === month);

            return (
              <div 
                key={month} 
                className={cn(
                  "flex flex-col p-4 rounded-lg border transition-all",
                  isAssigned && "bg-green-50/50 border-green-200",
                  isCurrent && !isAssigned && "bg-blue-50 border-blue-400 ring-1 ring-blue-400 shadow-sm",
                  isPending && "bg-slate-50 border-slate-200 opacity-60"
                )}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={cn(
                    "text-sm font-bold",
                    isAssigned && "text-green-700",
                    isCurrent && !isAssigned && "text-blue-700",
                    isPending && "text-slate-500"
                  )}>Month {month}</span>
                  
                  {isAssigned && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {isCurrent && !isAssigned && <Clock className="h-4 w-4 text-blue-500" />}
                  {isPending && <Circle className="h-4 w-4 text-slate-300" />}
                </div>
                
                {isAssigned && (
                  <div className="text-xs text-green-600 font-medium truncate mb-1">
                    {assignment.enrollment?.member?.fullName}
                  </div>
                )}

                <div className="mt-auto space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Due</span>
                    <span className="font-medium">₹{payment?.amountDue?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Pot</span>
                    <span className="font-medium text-green-600">₹{payout?.potAmount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Month Assignment + History */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Current Month Pot Assignment Card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Current Month Pot Assignment</h2>
          {pool.status === 'COMPLETED' ? (
            <p className="text-muted-foreground text-sm">Pool is completed. No more assignments.</p>
          ) : currentPotAssignment ? (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4" />
                <span className="font-semibold">Month {pool.currentMonth} — Locked</span>
              </div>
              <p className="text-sm">Recipient: <strong>{currentPotAssignment.enrollment?.member?.fullName}</strong></p>
              <p className="text-sm mt-1 text-green-700">Amount: ₹{currentPotAssignment.potAmount?.toLocaleString()}</p>
              <p className="text-sm mt-1 text-green-700">Mode: {currentPotAssignment.paymentMode}</p>
              {currentPotAssignment.notes && (
                <p className="text-xs mt-2 opacity-75">Notes: {currentPotAssignment.notes}</p>
              )}
              <p className="text-xs mt-2 opacity-60">Assigned on {new Date(currentPotAssignment.assignedAt).toLocaleDateString()}</p>

              {/* Owner Override Button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => {
                  setOverrideId(currentPotAssignment.id);
                  setOverrideRecipientId('');
                  setOverrideNotes('');
                }}
              >
                <ShieldAlert className="h-3 w-3 mr-1" /> Owner Override
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="text-sm text-primary font-bold bg-primary/10 rounded-md p-2 w-max mb-2">
                Pot Amount: ₹{currentPotAmount.toLocaleString()}
              </div>

              {/* AI Suggestion Card */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-purple-800 flex items-center gap-1.5">
                    <Trophy className="h-4 w-4" /> Smart Suggestion (AI)
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs text-purple-700 hover:bg-purple-100 p-1"
                    onClick={getAiSuggestion}
                    disabled={isAiLoading}
                  >
                    {isAiLoading ? 'Analyzing...' : (aiSuggestion ? 'Refresh' : 'Get Recommendation')}
                  </Button>
                </div>
                
                {aiSuggestion ? (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                    <p className="text-xs font-medium text-purple-900 mb-1">
                      Recommended: <span className="font-bold underline">{eligibleMembers.find(e => e.id === aiSuggestion.suggestedMemberId)?.member?.fullName || 'Selected Member'}</span>
                    </p>
                    <p className="text-[11px] text-purple-700 italic leading-relaxed mb-3">"{aiSuggestion.reason}"</p>
                    <Button 
                      size="sm" 
                      className="w-full h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs"
                      onClick={() => {
                        setSelectedRecipientId(aiSuggestion.suggestedMemberId);
                        setPotNotes(`AI Suggested: ${aiSuggestion.reason}`);
                      }}
                    >
                      Apply Suggestion
                    </Button>
                  </div>
                ) : !isAiLoading && (
                  <p className="text-[11px] text-purple-600/70">Click to let AI analyze candidate reliability and fairness to suggest the best recipient.</p>
                )}

                {isAiLoading && (
                  <div className="space-y-2 py-1">
                    <div className="h-3 w-3/4 bg-purple-200 animate-pulse rounded"></div>
                    <div className="h-3 w-1/2 bg-purple-200 animate-pulse rounded"></div>
                  </div>
                )}
              </div>

              <label className="text-sm font-medium">Select Recipient</label>
              <select 
                value={selectedRecipientId} 
                onChange={e => setSelectedRecipientId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                <option value="">-- Choose Eligible Member --</option>
                {eligibleMembers.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.member.fullName} (Slot #{e.slotNumber})</option>
                ))}
              </select>

              <label className="text-sm font-medium mt-1">Payment Mode</label>
              <select 
                value={paymentMode} 
                onChange={e => setPaymentMode(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                <option value="BANK">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
              </select>

              <label className="text-sm font-medium mt-1">Notes</label>
              <input 
                type="text" 
                value={potNotes} 
                onChange={e => setPotNotes(e.target.value)} 
                className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm" 
                placeholder="Reason for selection..." 
              />
              
              <Button 
                variant="default"
                className="mt-4"
                disabled={!selectedRecipientId || assignPotMutation.isPending}
                onClick={() => {
                  if (confirm("⚠️ This cannot be undone.\n\nAssigning the pot will permanently lock this month. Are you sure you want to proceed?")) {
                    assignPotMutation.mutate({ amount: currentPotAmount, month: pool.currentMonth });
                  }
                }}
              >
                Confirm Pot Assignment
              </Button>
            </div>
          )}
        </div>

        {/* Assignment History Table */}
        <div className="rounded-xl border bg-card p-6 shadow-sm overflow-hidden flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Assignment History</h2>
          <div className="overflow-y-auto max-h-[400px]">
            {potAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pots assigned yet.</p>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3">Member</th>
                    <th className="py-2 px-3 text-right">Pot Amount</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {potAssignments.map((pot: any) => (
                    <tr key={pot.id} className="border-t">
                      <td className="py-2 px-3">M{pot.month}</td>
                      <td className="py-2 px-3 font-medium">{pot.enrollment?.member?.fullName}</td>
                      <td className="py-2 px-3 text-right text-green-600 font-semibold">₹{pot.potAmount?.toLocaleString()}</td>
                      <td className="py-2 px-3 text-muted-foreground">{new Date(pot.assignedAt).toLocaleDateString()}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs max-w-[120px] truncate">{pot.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Override Modal */}
      {overrideId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setOverrideId(null)}>
          <div className="bg-card rounded-xl border shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" /> Owner Override
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Reassign the pot for this locked month. This is an admin-only action.
            </p>
            
            <label className="text-sm font-medium block mb-1">New Recipient</label>
            <select 
              value={overrideRecipientId} 
              onChange={e => setOverrideRecipientId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm mb-3"
            >
              <option value="">-- Choose Member --</option>
              {getOverrideEligible(
                potAssignments.find((p: any) => p.id === overrideId)?.enrollmentId || ''
              ).filter((e: any) => e.id !== potAssignments.find((p: any) => p.id === overrideId)?.enrollmentId)
                .map((e: any) => (
                <option key={e.id} value={e.id}>{e.member.fullName} (Slot #{e.slotNumber})</option>
              ))}
            </select>

            <label className="text-sm font-medium block mb-1">Override Notes</label>
            <input 
              type="text" 
              value={overrideNotes} 
              onChange={e => setOverrideNotes(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm mb-4" 
              placeholder="Reason for override..."
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOverrideId(null)}>Cancel</Button>
              <Button 
                variant="destructive"
                disabled={!overrideRecipientId || overrideMutation.isPending}
                onClick={() => {
                  if (confirm("⚠️ You are overriding a LOCKED month. This will reassign the pot to a different member. Continue?")) {
                    overrideMutation.mutate({
                      assignmentId: overrideId,
                      enrollmentId: overrideRecipientId,
                      notes: overrideNotes
                    });
                  }
                }}
              >
                Confirm Override
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
