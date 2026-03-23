import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';



interface Member {
  id: string;
  fullName: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  aadhaarRef?: string;
  panRef?: string;
  nomineeName?: string;
  nomineePhone?: string;
  status: string;
  riskLevel?: string;
  riskReason?: string;
  enrollments: any[];
}

const emptyForm = {
  fullName: '', phone: '', alternatePhone: '', address: '',
  aadhaarRef: '', panRef: '', nomineeName: '', nomineePhone: ''
};

export function Members() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData]   = useState({ ...emptyForm });
  const [editData, setEditData]   = useState({ ...emptyForm });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await api.get('/api/members');
      return res.data;
    }
  });

  const createMember = useMutation({
    mutationFn: async () => api.post('/api/members', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setIsAdding(false);
      setFormData({ ...emptyForm });
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Failed to add member')
  });

  const updateMember = useMutation({
    mutationFn: async (id: string) => api.put(`/api/members/${id}`, editData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setEditingId(null);
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Failed to update member')
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setDeleteConfirmId(null);
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Failed to delete member')
  });

  const startEdit = (m: Member) => {
    setEditingId(m.id);
    setEditData({
      fullName: m.fullName, phone: m.phone, alternatePhone: m.alternatePhone || '',
      address: m.address, aadhaarRef: m.aadhaarRef || '',
      panRef: m.panRef || '', nomineeName: m.nomineeName || '',
      nomineePhone: m.nomineePhone || ''
    });
  };

  const filteredMembers = members?.filter(m =>
    m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone.includes(searchQuery)
  );

  if (isLoading) return <div className="p-4">Loading members...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <Button onClick={() => { setIsAdding(true); setEditingId(null); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Member
        </Button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Add New Member</h2>
          <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" onSubmit={e => { e.preventDefault(); createMember.mutate(); }}>
            <div className="grid gap-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input required value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Phone Number <span className="text-destructive">*</span></Label>
              <Input required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Address <span className="text-destructive">*</span></Label>
              <Input required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Alternate Phone <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input value={formData.alternatePhone} onChange={e => setFormData({ ...formData, alternatePhone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Aadhaar Reference <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input value={formData.aadhaarRef} onChange={e => setFormData({ ...formData, aadhaarRef: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>PAN Reference <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input value={formData.panRef} onChange={e => setFormData({ ...formData, panRef: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Nominee Name <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input value={formData.nomineeName} onChange={e => setFormData({ ...formData, nomineeName: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Nominee Phone <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input value={formData.nomineePhone} onChange={e => setFormData({ ...formData, nomineePhone: e.target.value })} />
            </div>
            <div className="col-span-full flex justify-end gap-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button type="submit" disabled={createMember.isPending}>Save Member</Button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="flex">
        <Input
          className="max-w-md"
          placeholder="Search members by name or phone..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="py-3 px-4 font-medium">Name</th>
              <th className="py-3 px-4 font-medium">Phone</th>
              <th className="py-3 px-4 font-medium">Address</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Risk</th>
              <th className="py-3 px-4 font-medium">Pools</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers?.map(member => (
              <>
                <tr key={member.id} className="border-t transition-colors hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{member.fullName}</td>
                  <td className="py-3 px-4">{member.phone}</td>
                  <td className="py-3 px-4 max-w-[150px] truncate text-muted-foreground" title={member.address}>{member.address}</td>
                  <td className="py-3 px-4">
                    {member.status === 'DEFAULTER'
                      ? <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 font-bold">DEFAULTER</span>
                      : <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">{member.status}</span>
                    }
                  </td>
                  <td className="py-3 px-4">
                    {member.riskLevel === 'Low' && <span className="px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 border border-green-200" title={member.riskReason}>🟢 Low</span>}
                    {member.riskLevel === 'Medium' && <span className="px-2 py-1 text-xs rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200" title={member.riskReason}>🟡 Medium</span>}
                    {member.riskLevel === 'High' && <span className="px-2 py-1 text-xs rounded-full bg-red-50 text-red-700 border border-red-200" title={member.riskReason}>🔴 High</span>}
                    {!member.riskLevel && <span className="px-2 py-1 text-xs rounded-full bg-gray-50 text-gray-400 border border-gray-200">⚪ —</span>}
                  </td>
                  <td className="py-3 px-4">{member.enrollments?.length || 0}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link to={`/members/${member.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => editingId === member.id ? setEditingId(null) : startEdit(member)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => setDeleteConfirmId(member.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>

                {/* Inline Edit Row */}
                {editingId === member.id && (
                  <tr key={`edit-${member.id}`} className="bg-primary/5 border-t">
                    <td colSpan={7} className="px-4 py-4">
                      <form className="grid gap-3 md:grid-cols-3 lg:grid-cols-4" onSubmit={e => { e.preventDefault(); updateMember.mutate(member.id); }}>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Full Name *</Label>
                          <Input required value={editData.fullName} onChange={e => setEditData({ ...editData, fullName: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Phone *</Label>
                          <Input required value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Address *</Label>
                          <Input required value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Alternate Phone</Label>
                          <Input value={editData.alternatePhone} onChange={e => setEditData({ ...editData, alternatePhone: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Aadhaar Ref</Label>
                          <Input value={editData.aadhaarRef} onChange={e => setEditData({ ...editData, aadhaarRef: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">PAN Ref</Label>
                          <Input value={editData.panRef} onChange={e => setEditData({ ...editData, panRef: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Nominee Name</Label>
                          <Input value={editData.nomineeName} onChange={e => setEditData({ ...editData, nomineeName: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Nominee Phone</Label>
                          <Input value={editData.nomineePhone} onChange={e => setEditData({ ...editData, nomineePhone: e.target.value })} />
                        </div>
                        <div className="col-span-full flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5 mr-1" /> Cancel
                          </Button>
                          <Button type="submit" size="sm" disabled={updateMember.isPending}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Save Changes
                          </Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}

                {/* Delete Confirm Row */}
                {deleteConfirmId === member.id && (
                  <tr key={`del-${member.id}`} className="bg-destructive/5 border-t">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-destructive font-medium flex-1">
                          ⚠️ Are you sure you want to delete <strong>{member.fullName}</strong>? This cannot be undone.
                        </p>
                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                        <Button
                          size="sm"
                          className="bg-destructive hover:bg-destructive/90 text-white"
                          disabled={deleteMember.isPending}
                          onClick={() => deleteMember.mutate(member.id)}
                        >
                          Yes, Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filteredMembers?.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">No members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
