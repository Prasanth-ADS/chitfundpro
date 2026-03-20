import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  Search, 
  User, 
  Coins, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

type ReportType = 'passbook' | 'pool-summary' | 'defaulters' | 'collection' | 'closure' | 'profit';

export function Reports() {
  const [reportType, setReportType] = useState<ReportType>('passbook');
  const [filters, setFilters] = useState<any>({
    memberId: '',
    poolId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const { data: members } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/members', { withCredentials: true });
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

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['report', reportType, filters],
    queryFn: async () => {
      let url = '';
      if (reportType === 'passbook') {
        if (!filters.memberId || !filters.poolId) return null;
        url = `http://localhost:5000/api/reports/member-passbook/${filters.memberId}/${filters.poolId}`;
      } else if (reportType === 'pool-summary') {
        if (!filters.poolId) return null;
        url = `http://localhost:5000/api/reports/pool-summary/${filters.poolId}`;
      } else if (reportType === 'defaulters') {
        url = `http://localhost:5000/api/reports/defaulters`;
      } else if (reportType === 'collection') {
        url = `http://localhost:5000/api/reports/monthly-collection?month=${filters.month}&year=${filters.year}`;
      } else if (reportType === 'closure') {
        if (!filters.poolId) return null;
        url = `http://localhost:5000/api/reports/pool-closure/${filters.poolId}`;
      } else if (reportType === 'profit') {
        url = `http://localhost:5000/api/reports/yearly-profit?year=${filters.year}`;
      }
      const res = await axios.get(url, { withCredentials: true });
      return res.data;
    },
    enabled: !!reportType
  });

  const exportExcel = () => {
    if (!reportData) return;
    let dataToExport = [];
    if (reportType === 'passbook') dataToExport = reportData.entries;
    else if (reportType === 'pool-summary') dataToExport = reportData;
    else if (reportType === 'defaulters') dataToExport = reportData;
    else if (reportType === 'collection') dataToExport = Object.entries(reportData).map(([k, v]: any) => ({ Pool: k, ...v }));
    else if (reportType === 'profit') dataToExport = reportData.pools;
    else dataToExport = [reportData];

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${reportType}_report.xlsx`);
  };

  const exportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF() as any;
    doc.text(`${reportType.toUpperCase()} REPORT`, 14, 15);
    
    let columns: string[] = [];
    let rows: any[][] = [];

    if (reportType === 'passbook') {
      columns = ["Month", "Due", "Paid", "Mode", "Date", "Status"];
      rows = reportData.entries.map((e: any) => [e.month, e.amountDue, e.amountPaid, e.mode, e.date ? new Date(e.date).toLocaleDateString() : '-', e.status]);
    } else if (reportType === 'pool-summary') {
      columns = ["Month", "Collected", "Pot Paid", "Balance"];
      rows = reportData.map((e: any) => [e.month, e.totalCollected, e.potPaid, e.balance]);
    } else if (reportType === 'defaulters') {
      columns = ["Name", "Phone", "Pool", "Missed", "Last Payment"];
      rows = reportData.map((e: any) => [e.name, e.phone, e.pool, e.missedCount, e.lastPayment ? new Date(e.lastPayment).toLocaleDateString() : '-']);
    } else if (reportType === 'collection') {
       columns = ["Pool", "CASH", "UPI", "BANK", "Total"];
       rows = Object.entries(reportData).map(([k, v]: any) => [k, v.CASH, v.UPI, v.BANK, v.total]);
    } else if (reportType === 'profit') {
       columns = ["Pool", "Profit"];
       rows = reportData.pools.map((p: any) => [p.poolName, p.profit]);
    }

    doc.autoTable({ head: [columns], body: rows, startY: 20 });
    doc.save(`${reportType}_report.pdf`);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!reportData}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={!reportData}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Report SelectorSidebar */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          <ReportButton active={reportType === 'passbook'} onClick={() => setReportType('passbook')} icon={User} label="Member Passbook" />
          <ReportButton active={reportType === 'pool-summary'} onClick={() => setReportType('pool-summary')} icon={Coins} label="Pool Summary" />
          <ReportButton active={reportType === 'defaulters'} onClick={() => setReportType('defaulters')} icon={AlertTriangle} label="Defaulters List" />
          <ReportButton active={reportType === 'collection'} onClick={() => setReportType('collection')} icon={TrendingUp} label="Monthly Collection" />
          <ReportButton active={reportType === 'closure'} onClick={() => setReportType('closure')} icon={CheckCircle} label="Pool Closure" />
          <ReportButton active={reportType === 'profit'} onClick={() => setReportType('profit')} icon={FileText} label="Yearly Profit" />
        </div>

        {/* Filters and Preview */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {(reportType === 'passbook') && (
                <div>
                  <Label>Member</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.memberId}
                    onChange={e => setFilters({...filters, memberId: e.target.value})}
                  >
                    <option value="">Select Member</option>
                    {members?.map((m: any) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                  </select>
                </div>
              )}
              {(reportType === 'passbook' || reportType === 'pool-summary' || reportType === 'closure') && (
                <div>
                  <Label>Pool</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.poolId}
                    onChange={e => setFilters({...filters, poolId: e.target.value})}
                  >
                    <option value="">Select Pool</option>
                    {pools?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {(reportType === 'collection') && (
                <div>
                  <Label>Month</Label>
                  <Input type="number" value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})} min={1} max={12} />
                </div>
              )}
              {(reportType === 'collection' || reportType === 'profit') && (
                <div>
                  <Label>Year</Label>
                  <Input type="number" value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})} />
                </div>
              )}
              <div className="flex items-end">
                <Button className="w-full" onClick={() => refetch()}>
                  <Search className="mr-2 h-4 w-4" /> Generate Report
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm overflow-auto max-h-[600px]">
            {isLoading ? (
              <p className="text-center py-10">Loading report data...</p>
            ) : !reportData ? (
              <p className="text-center py-10 text-muted-foreground">Select parameters and click Generate Report.</p>
            ) : (
              <div className="w-full">
                {reportType === 'passbook' && <Table headers={["Month", "Due", "Paid", "Mode", "Date", "Status"]} data={reportData.entries.map((e: any) => [e.month, `₹${e.amountDue.toLocaleString()}`, `₹${e.amountPaid.toLocaleString()}`, e.mode, e.date ? new Date(e.date).toLocaleDateString() : '-', e.status])} />}
                {reportType === 'pool-summary' && <Table headers={["Month", "Collected", "Pot Paid", "Balance"]} data={reportData.map((e: any) => [e.month, `₹${e.totalCollected.toLocaleString()}`, `₹${e.potPaid.toLocaleString()}`, `₹${e.balance.toLocaleString()}`])} />}
                {reportType === 'defaulters' && <Table headers={["Name", "Phone", "Pool", "Missed"]} data={reportData.map((e: any) => [e.name, e.phone, e.pool, e.missedCount])} />}
                {reportType === 'collection' && <Table headers={["Pool", "CASH", "UPI", "BANK", "Total"]} data={Object.entries(reportData).map(([k, v]: any) => [k, `₹${v.CASH.toLocaleString()}`, `₹${v.UPI.toLocaleString()}`, `₹${v.BANK.toLocaleString()}`, `₹${v.total.toLocaleString()}`])} />}
                {reportType === 'closure' && (
                  <div className="p-4 space-y-4">
                    <h2 className="text-2xl font-bold border-b pb-2">{reportData.poolName} - Conclusion</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg"><p className="text-muted-foreground">Total Collected</p><p className="text-xl font-bold font-mono">₹{reportData.totalCollected.toLocaleString()}</p></div>
                      <div className="p-4 border rounded-lg"><p className="text-muted-foreground">Total Payouts</p><p className="text-xl font-bold font-mono">₹{reportData.totalPaidOut.toLocaleString()}</p></div>
                      <div className="p-4 border rounded-lg bg-emerald-50 col-span-2"><p className="text-emerald-700 font-semibold">Net Company Profit (Commission)</p><p className="text-2xl font-black text-emerald-800 font-mono">₹{reportData.commission.toLocaleString()}</p></div>
                    </div>
                  </div>
                )}
                {reportType === 'profit' && (
                  <div>
                    <Table headers={["Pool", "Net Profit"]} data={reportData.pools.map((p: any) => [p.poolName, `₹${p.profit.toLocaleString()}`])} />
                    <div className="mt-4 p-4 bg-emerald-50 rounded-lg flex justify-between items-center"><span className="font-bold">Total Annual Profit</span><span className="text-xl font-black text-emerald-800">₹{reportData.totalProfit.toLocaleString()}</span></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${active ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border hover:bg-muted'}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function Table({ headers, data }: { headers: string[], data: any[][] }) {
  return (
    <table className="w-full text-sm text-left">
      <thead className="bg-muted/50 border-b">
        <tr>
          {headers.map(h => <th key={h} className="py-2 px-3 font-semibold">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
            {row.map((cell, j) => <td key={j} className="py-2 px-3">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
