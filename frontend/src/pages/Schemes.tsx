import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const API = 'http://localhost:5000/api/schemes';

interface Scheme {
  id: string; name: string; poolAmount: number;
  numberOfMembers: number; numberOfMonths: number;
  paymentSchedule: Array<{ month: number; amountDue: number }>;
  payoutSchedule:  Array<{ month: number; potAmount: number }>;
}

export function Schemes() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating]       = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [editName, setEditName]           = useState('');

  // Create form
  const [newName, setNewName]           = useState('');
  const [newPoolAmount, setNewPoolAmount] = useState('');
  const [newMembers, setNewMembers]     = useState('20');
  const [newMonths, setNewMonths]       = useState('20');

  const { data: schemes, isLoading } = useQuery<Scheme[]>({
    queryKey: ['schemes'],
    queryFn: async () => (await axios.get(API, { withCredentials: true })).data
  });

  const createScheme = useMutation({
    mutationFn: async () => axios.post(API, {
      name: newName, poolAmount: Number(newPoolAmount),
      numberOfMembers: Number(newMembers), numberOfMonths: Number(newMonths)
    }, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemes'] });
      queryClient.invalidateQueries({ queryKey: ['schemes-meta'] });
      setIsCreating(false); setNewName(''); setNewPoolAmount(''); setNewMembers('20'); setNewMonths('20');
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Failed to create scheme')
  });

  const updateScheme = useMutation({
    mutationFn: async (id: string) => axios.put(`${API}/${id}`, { name: editName }, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemes'] });
      queryClient.invalidateQueries({ queryKey: ['schemes-meta'] });
      setEditingId(null);
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Failed to update scheme')
  });

  const deleteScheme = useMutation({
    mutationFn: async (id: string) => axios.delete(`${API}/${id}`, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemes'] });
      queryClient.invalidateQueries({ queryKey: ['schemes-meta'] });
      setDeleteConfirmId(null);
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Failed to delete scheme')
  });

  if (isLoading) return <div className="p-4">Loading schemes...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Schemes</h1>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Scheme
        </Button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create New Scheme</h2>
          <p className="text-sm text-muted-foreground mb-4">Payment and payout schedules are auto-generated as flat monthly amounts. You can customise them later.</p>
          <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end" onSubmit={e => { e.preventDefault(); createScheme.mutate(); }}>
            <div className="grid gap-2">
              <Label>Scheme Name *</Label>
              <Input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. ₹1 Lakh Scheme" />
            </div>
            <div className="grid gap-2">
              <Label>Pool Amount (₹) *</Label>
              <Input required type="number" min="1" value={newPoolAmount} onChange={e => setNewPoolAmount(e.target.value)} placeholder="100000" />
            </div>
            <div className="grid gap-2">
              <Label>No. of Members</Label>
              <Input type="number" min="2" value={newMembers} onChange={e => setNewMembers(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>No. of Months</Label>
              <Input type="number" min="2" value={newMonths} onChange={e => setNewMonths(e.target.value)} />
            </div>
            <div className="col-span-full flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button type="submit" disabled={createScheme.isPending}>Create Scheme</Button>
            </div>
          </form>
        </div>
      )}

      {/* Scheme Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schemes?.map(scheme => (
          <div key={scheme.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {/* Card Body */}
            <div className="p-6">
              {editingId === scheme.id ? (
                /* Inline Edit */
                <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); updateScheme.mutate(scheme.id); }}>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Scheme Name *</Label>
                    <Input required value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                    <Button type="submit" size="sm" className="flex-1" disabled={updateScheme.isPending}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <h3 className="text-xl font-semibold mb-4">{scheme.name}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Pot Amount</p>
                      <p className="font-semibold text-base">₹{scheme.poolAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Duration</p>
                      <p className="font-semibold text-base">{scheme.numberOfMonths} Months</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Members</p>
                      <p className="font-medium">{scheme.numberOfMembers}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Monthly Instalment</p>
                      <p className="font-medium">₹{Math.round(scheme.poolAmount / scheme.numberOfMonths).toLocaleString()}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Delete Confirm */}
            {deleteConfirmId === scheme.id && (
              <div className="px-5 py-3 bg-destructive/5 border-t border-destructive/20">
                <p className="text-xs text-destructive font-medium mb-2">⚠️ Delete <strong>{scheme.name}</strong>? Cannot delete if it has pools.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                  <Button size="sm" className="flex-1 bg-destructive hover:bg-destructive/90 text-white" disabled={deleteScheme.isPending} onClick={() => deleteScheme.mutate(scheme.id)}>Delete</Button>
                </div>
              </div>
            )}

            {/* Actions + Schedule Toggle */}
            <div className="px-5 py-2.5 border-t flex items-center justify-between gap-1.5 bg-muted/10">
              <Button
                variant="ghost" size="sm"
                className="h-7 px-2.5 text-xs text-muted-foreground"
                onClick={() => setExpandedId(expandedId === scheme.id ? null : scheme.id)}
              >
                {expandedId === scheme.id ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                Schedule
              </Button>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs"
                  onClick={() => { setEditingId(scheme.id); setEditName(scheme.name); setDeleteConfirmId(null); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => { setDeleteConfirmId(scheme.id); setEditingId(null); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            </div>

            {/* Expandable Schedule Table */}
            {expandedId === scheme.id && (
              <div className="border-t overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="py-2 px-3 font-medium text-muted-foreground">Month</th>
                      <th className="py-2 px-3 font-medium text-muted-foreground">Due</th>
                      <th className="py-2 px-3 font-medium text-muted-foreground">Cumulative</th>
                      <th className="py-2 px-3 font-medium text-muted-foreground text-right">Pot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheme.paymentSchedule.map((pay, idx) => {
                      const pot = scheme.payoutSchedule.find(p => p.month === pay.month)?.potAmount || 0;
                      const cumulative = scheme.paymentSchedule.slice(0, idx + 1).reduce((s, p) => s + p.amountDue, 0);
                      return (
                        <tr key={pay.month} className="border-t hover:bg-muted/30">
                          <td className="py-1.5 px-3 font-medium">M{pay.month}</td>
                          <td className="py-1.5 px-3">₹{pay.amountDue.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-muted-foreground">₹{cumulative.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right text-green-600 font-medium">₹{pot.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {schemes?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground rounded-xl border border-dashed">
            No schemes found. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
}
