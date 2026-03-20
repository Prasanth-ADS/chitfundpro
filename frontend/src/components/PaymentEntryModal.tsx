import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function PaymentEntryModal({ isOpen, onClose, memberData, month }: any) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    amountPaid: 0,
    lateFee: 0,
    paymentMode: 'CASH',
    status: 'PAID',
    notes: '',
    paymentDate: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    if (memberData) {
      setFormData({
        amountPaid: memberData.amountPaid || memberData.amountDue,
        lateFee: memberData.lateFee || 0,
        paymentMode: memberData.paymentMode === 'NONE' ? 'CASH' : memberData.paymentMode,
        status: memberData.status === 'UNPAID' ? 'PAID' : memberData.status,
        notes: memberData.notes || '',
        paymentDate: memberData.paymentDate ? new Date(memberData.paymentDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      });
    }
  }, [memberData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/payments', {
        enrollmentId: memberData.enrollmentId,
        month,
        amountDue: memberData.amountDue,
        amountPaid: Number(formData.amountPaid),
        lateFee: Number(formData.lateFee),
        paymentMode: formData.paymentMode,
        status: formData.status,
        notes: formData.notes,
        paymentDate: formData.paymentDate
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-payments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
      onClose();
    }
  });

  if (!memberData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment for {memberData.memberName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Amount Due</Label>
            <div className="col-span-3 font-semibold text-lg text-primary">₹{(memberData.amountDue || 0).toLocaleString()}</div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Amount Paid</Label>
            <Input type="number" value={formData.amountPaid} onChange={e => setFormData({...formData, amountPaid: e.target.value as any})} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Status</Label>
            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <option value="PAID">PAID</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="ADVANCE">ADVANCE</option>
            </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Mode</Label>
            <select value={formData.paymentMode} onChange={e => setFormData({...formData, paymentMode: e.target.value})} className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="BANK">BANK</option>
            </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Late Fee</Label>
            <Input type="number" value={formData.lateFee} onChange={e => setFormData({...formData, lateFee: e.target.value as any})} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Date</Label>
            <Input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Notes</Label>
            <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="col-span-3" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Save Payment</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
