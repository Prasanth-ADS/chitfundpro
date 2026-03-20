import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Printer, Trophy } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';

export function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState('');

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: async () => {
      const res = await axios.get(`http://localhost:5000/api/members/${id}`, { withCredentials: true });
      return res.data;
    }
  });

  const { data: riskData, isLoading: isLoadingRisk } = useQuery({
    queryKey: ['member-risk', id],
    queryFn: async () => {
      const res = await axios.get(`http://localhost:5000/api/ai/risk/${id}`, { withCredentials: true });
      return res.data;
    }
  });

  const { data: pools } = useQuery({
    queryKey: ['pools'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/pools', { withCredentials: true });
      return res.data;
    }
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('http://localhost:5000/api/enrollments', { memberId: id, poolId: selectedPoolId }, { withCredentials: true });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      setIsEnrolling(false);
      setSelectedPoolId('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error enrolled member');
    }
  });

  const payMutation = useMutation({
    mutationFn: async ({ enrollmentId, month, amount }: any) => {
      await axios.post('http://localhost:5000/api/payments', { enrollmentId, month, amount }, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', id] });
    }
  });

  if (isLoading) return <div className="p-4">Loading profile...</div>;
  if (!member) return <div className="p-4">Member not found</div>;

  let totalDuesAllPools = 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/members" className="p-2 hover:bg-muted rounded-full transition">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{member.fullName}</h1>
            <p className="text-muted-foreground mt-1">Status: <span className={`font-bold ${member.status === 'DEFAULTER' ? 'text-red-600' : 'text-green-600'}`}>{member.status}</span></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print Passbook</Button>
            <Button onClick={() => setIsEnrolling(true)}>Enroll in Pool</Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 print:hidden">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Personal Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground mb-1">Phone</p><p className="font-medium">{member.phone}</p></div>
            <div><p className="text-muted-foreground mb-1">Alt Phone</p><p className="font-medium">{member.alternatePhone || 'N/A'}</p></div>
            <div><p className="text-muted-foreground mb-1">Aadhaar</p><p className="font-medium">{member.aadhaarReference}</p></div>
            <div><p className="text-muted-foreground mb-1">PAN</p><p className="font-medium">{member.panReference}</p></div>
            <div className="col-span-2"><p className="text-muted-foreground mb-1">Address</p><p className="font-medium">{member.address}</p></div>
            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="font-medium mb-3">Nominee Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-muted-foreground mb-1">Name</p><p className="font-medium">{member.nomineeName}</p></div>
                <div><p className="text-muted-foreground mb-1">Phone</p><p className="font-medium">{member.nomineePhone}</p></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* AI Risk Card */}
          <div className="rounded-xl border bg-card p-6 shadow-sm border-primary/20 bg-primary/5">
            <h2 className="text-xl font-semibold mb-4">AI Risk Prediction</h2>
            {isLoadingRisk ? (
              <div className="animate-pulse space-y-2">
                <div className="h-6 w-24 bg-primary/20 rounded"></div>
                <div className="h-4 w-full bg-primary/10 rounded"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Assessed Level:</span>
                  {riskData?.risk === 'Low' && <span className="px-3 py-1 font-semibold text-sm rounded-full bg-green-100 text-green-800 border border-green-200">🟢 Low</span>}
                  {riskData?.risk === 'Medium' && <span className="px-3 py-1 font-semibold text-sm rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">🟡 Medium</span>}
                  {riskData?.risk === 'High' && <span className="px-3 py-1 font-semibold text-sm rounded-full bg-red-100 text-red-800 border border-red-200">🔴 High</span>}
                  {!['Low','Medium','High'].includes(riskData?.risk) && <span className="px-3 py-1 font-semibold text-sm rounded-full bg-gray-100 text-gray-800">⚪ Unknown</span>}
                </div>
                {riskData?.reason && (
                  <p className="text-sm text-muted-foreground">{riskData.reason}</p>
                )}
              </div>
            )}
          </div>
          
          {/* Enrollment Panel */}
          {isEnrolling && (
          <div className="rounded-xl border bg-card p-6 shadow-sm border-primary/50">
            <h2 className="text-xl font-semibold mb-4">Enroll in Pool</h2>
            <div className="gap-4 flex flex-col">
              <div>
                <Label className="mb-2 block">Select Active Pool</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedPoolId} 
                  onChange={e => setSelectedPoolId(e.target.value)}
                >
                  <option value="">Select Pool</option>
                  {pools?.filter((p: any) => p.status !== 'COMPLETED').map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.scheme.name})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setIsEnrolling(false)}>Cancel</Button>
                <Button onClick={() => enrollMutation.mutate()} disabled={!selectedPoolId || enrollMutation.isPending}>Confirm Enrollment</Button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm print:hidden">
        <h2 className="text-xl font-semibold mb-4">Enrolled Pools & Dues</h2>
        {member.enrollments?.length === 0 ? (
          <p className="text-muted-foreground">No active enrollments.</p>
        ) : (
          <div className="grid gap-6">
            {member.enrollments.map((enr: any) => {
              const currentMonth = enr.pool.currentMonth;
              const schedule = typeof enr.pool.scheme.paymentSchedule === 'string' 
                ? JSON.parse(enr.pool.scheme.paymentSchedule) 
                : enr.pool.scheme.paymentSchedule;
              
              const currentDueData = schedule.find((s: any) => s.month === currentMonth);
              const amountDue = currentDueData?.amountDue || 0;
              
              const hasPaidCurrent = enr.payments.some((p: any) => p.month === currentMonth);
              if (!hasPaidCurrent && enr.pool.status !== 'COMPLETED') totalDuesAllPools += amountDue;

              return (
                <div key={enr.id} className="border p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{enr.pool.name} <span className="text-sm font-normal text-muted-foreground ml-2">Slot #{enr.slotNumber}</span></h3>
                    <p className="text-sm text-muted-foreground">{enr.pool.scheme.name} | Month {currentMonth}/{enr.pool.scheme.numberOfMonths || 20}</p>
                    {enr.potReceived && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {enr.potAssignments?.length > 0 ? (
                          enr.potAssignments.map((pa: any) => (
                            <span key={pa.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                              <Trophy className="h-3 w-3" />
                              Received pot in {pa.pool?.name || enr.pool.name} — Month {pa.month}
                              {pa.potAmount && <span className="text-green-700 ml-1">₹{pa.potAmount.toLocaleString()}</span>}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                            <Trophy className="h-3 w-3" />
                            Received pot in {enr.pool.name} — Month {enr.potReceivedMonth}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    {!hasPaidCurrent && enr.pool.status !== 'COMPLETED' ? (
                      <>
                        <p className="text-sm text-red-600 font-medium pb-1">Due for Month {currentMonth}: ₹{amountDue.toLocaleString()}</p>
                        <Button size="sm" onClick={() => payMutation.mutate({ enrollmentId: enr.id, month: currentMonth, amount: amountDue })} disabled={payMutation.isPending}>Record Payment</Button>
                      </>
                    ) : (
                      <p className="text-sm text-green-600 font-medium">Up to date</p>
                    )}
                  </div>
                </div>
              );
            })}
            
            <div className="bg-slate-50 p-4 border rounded-lg flex justify-between items-center mt-2">
              <span className="font-semibold text-lg">Total Dues Across All Pools (This Month)</span>
              <span className="font-bold text-xl text-red-600">₹{totalDuesAllPools.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm passbook-print">
        <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
          <span>Member Passbook</span>
          <span className="text-sm font-medium text-muted-foreground hidden print:block">Printed on {new Date().toLocaleDateString()}</span>
        </h2>
        
        {member.enrollments?.map((enr: any) => (
          <div key={enr.id} className="mb-8">
            <h3 className="font-bold border-b pb-2 mb-3">{enr.pool.name} - Slot {enr.slotNumber}</h3>
            {enr.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground pb-4">No payments recorded yet.</p>
            ) : (
              <table className="w-full text-sm text-left border mb-4">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3">Amount Paid</th>
                    <th className="py-2 px-3 text-right">Date Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {enr.payments.sort((a: any, b: any) => a.month - b.month).map((p: any) => (
                    <tr key={p.id} className="border-b">
                      <td className="py-2 px-3 font-medium">Month {p.month}</td>
                      <td className="py-2 px-3 text-green-600 font-medium">₹{(p.amountPaid || 0).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{new Date(p.paidAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .passbook-print, .passbook-print * { visibility: visible; }
          .passbook-print { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}
