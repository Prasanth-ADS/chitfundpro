import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Link } from 'react-router-dom';

const API = 'http://localhost:5000/api/pools';

interface Scheme { id: string; name: string; }
interface Pool {
  id: string; name: string; schemeId: string; scheme: Scheme;
  startDate: string; status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED'; currentMonth: number;
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    UPCOMING:  'bg-slate-100 text-slate-800',
    ACTIVE:    'bg-green-100 text-green-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
  };
  return <span className={`px-2 py-1 text-xs rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
};

export function Pools() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterSchemeId, setFilterSchemeId]   = useState('all');

  // Create form state
  const [newName, setNewName]         = useState('');
  const [newSchemeId, setNewSchemeId] = useState('');
  const [newStartDate, setNewStartDate] = useState('');

  // Edit form state
  const [editName, setEditName]       = useState('');
  const [editStatus, setEditStatus]   = useState('');
  const [editStartDate, setEditStartDate] = useState('');

  const { data: pools, isLoading } = useQuery<Pool[]>({
    queryKey: ['pools'],
    queryFn: async () => (await axios.get(API, { withCredentials: true })).data
  });

  const { data: schemes } = useQuery<Scheme[]>({
    queryKey: ['schemes-meta'],
    queryFn: async () => (await axios.get('http://localhost:5000/api/schemes', { withCredentials: true })).data
  });

  const createPool = useMutation({
    mutationFn: async () => axios.post(API, { name: newName, schemeId: newSchemeId, startDate: newStartDate }, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pools'] });
      setIsCreating(false); setNewName(''); setNewSchemeId(''); setNewStartDate('');
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Failed to create pool')
  });

  const updatePool = useMutation({
    mutationFn: async (id: string) => axios.put(`${API}/${id}`, { name: editName, status: editStatus, startDate: editStartDate }, { withCredentials: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pools'] }); setEditingId(null); },
    onError: (e: any) => alert(e.response?.data?.message || 'Failed to update pool')
  });

  const deletePool = useMutation({
    mutationFn: async (id: string) => axios.delete(`${API}/${id}`, { withCredentials: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pools'] }); setDeleteConfirmId(null); },
    onError: (e: any) => alert(e.response?.data?.message || 'Failed to delete pool')
  });

  const startEdit = (p: Pool) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditStatus(p.status);
    setEditStartDate(p.startDate.split('T')[0]);
  };

  const filteredPools = filterSchemeId === 'all' ? pools : pools?.filter(p => p.schemeId === filterSchemeId);

  if (isLoading) return <div className="p-4">Loading pools...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Pools</h1>
        <Button onClick={() => { setIsCreating(true); setEditingId(null); }}>
          <Plus className="h-4 w-4 mr-2" /> Create Pool
        </Button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create New Pool</h2>
          <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end" onSubmit={e => { e.preventDefault(); createPool.mutate(); }}>
            <div className="grid gap-2">
              <Label>Pool Name *</Label>
              <Input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. October Batch" />
            </div>
            <div className="grid gap-2">
              <Label>Scheme *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required value={newSchemeId} onChange={e => setNewSchemeId(e.target.value)}
              >
                <option value="">Select Scheme</option>
                {schemes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Start Date *</Label>
              <Input type="date" required value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCreating(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createPool.isPending}>Save</Button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 items-center">
        <p className="text-sm font-medium text-muted-foreground min-w-max">Filter by Scheme:</p>
        <select
          className="h-9 w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={filterSchemeId} onChange={e => setFilterSchemeId(e.target.value)}
        >
          <option value="all">All Schemes</option>
          {schemes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Pool Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPools?.map(pool => (
          <div key={pool.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {/* Card Header */}
            {editingId !== pool.id ? (
              <Link to={`/pools/${pool.id}`} className="block p-6 hover:bg-muted/20 transition">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold">{pool.name}</h3>
                  {statusBadge(pool.status)}
                </div>
                <p className="text-sm text-muted-foreground mb-1">Scheme: <span className="font-medium text-foreground">{pool.scheme.name}</span></p>
                <p className="text-sm text-muted-foreground mb-4">Start: <span className="font-medium text-foreground">{new Date(pool.startDate).toLocaleDateString()}</span></p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Month</span>
                  <span className="font-bold text-lg">{pool.currentMonth} <span className="text-muted-foreground font-normal text-sm">/ 20</span></span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${(pool.currentMonth / 20) * 100}%` }} />
                </div>
              </Link>
            ) : (
              /* Inline Edit */
              <form className="p-5 bg-primary/5 flex flex-col gap-3" onSubmit={e => { e.preventDefault(); updatePool.mutate(pool.id); }}>
                <p className="text-sm font-semibold text-primary mb-1">Edit Pool</p>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Pool Name *</Label>
                  <Input required value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Status</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button type="submit" size="sm" className="flex-1" disabled={updatePool.isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                </div>
              </form>
            )}

            {/* Delete Confirm */}
            {deleteConfirmId === pool.id && (
              <div className="px-5 py-3 bg-destructive/5 border-t border-destructive/20">
                <p className="text-xs text-destructive font-medium mb-2">⚠️ Delete <strong>{pool.name}</strong>? This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                  <Button size="sm" className="flex-1 bg-destructive hover:bg-destructive/90 text-white" disabled={deletePool.isPending} onClick={() => deletePool.mutate(pool.id)}>Delete</Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {editingId !== pool.id && deleteConfirmId !== pool.id && (
              <div className="px-5 py-2.5 border-t flex justify-end gap-1.5 bg-muted/10">
                <Button variant="ghost" size="sm" onClick={() => startEdit(pool)} className="h-7 px-2.5 text-xs">
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(pool.id)} className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            )}
          </div>
        ))}

        {filteredPools?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground rounded-xl border border-dashed">
            No pools found. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
}
