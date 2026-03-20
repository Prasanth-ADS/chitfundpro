import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Users, 
  Coins, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  ArrowRight
} from "lucide-react";
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/dashboard/stats', { withCredentials: true });
      return res.data;
    }
  });

  if (isLoading) return <div className="p-6">Loading dashboard metrics...</div>;

  const collectionPercentage = stats ? Math.round((stats.collectionProgress.collected / stats.collectionProgress.expected) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
      </div>

      {/* Main Stats Rows */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">This Month's Collection</h3>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-1">₹{stats?.collectionProgress.collected.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Expected: ₹{stats?.collectionProgress.expected.toLocaleString()}</p>
          <div className="w-full bg-muted rounded-full h-1.5 mt-3">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(collectionPercentage, 100)}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-right mt-1 font-medium text-emerald-600">{collectionPercentage}% collected</div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Unpaid Members</h3>
            <Users className="h-4 w-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold mt-1">{stats?.unpaidMembersCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Need reminders</p>
          <Link to="/payments">
            <Button variant="link" size="sm" className="h-auto p-0 text-xs text-orange-600 mt-2">
              View Payments <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Unassigned Pots</h3>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold mt-1 text-rose-600">{stats?.unassignedPotsPools.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Due for current month</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Defaulters Flagged</h3>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold mt-1 text-destructive">{stats?.defaulterCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Critical attention needed</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Pools by Scheme */}
        <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Active Pools by Scheme
          </h2>
          <div className="space-y-4">
            {Object.entries(stats?.activePoolsByScheme || {}).map(([scheme, count]) => (
              <div key={scheme} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="text-sm font-medium">{scheme}</span>
                <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{count as number} Pools</span>
              </div>
            ))}
            {Object.keys(stats?.activePoolsByScheme || {}).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No active pools found.</p>
            )}
          </div>
        </div>

        {/* Unassigned Pots & Completions */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-rose-600">
              <Calendar className="h-5 w-5" /> Pending Pot Assignments
            </h2>
            <div className="grid gap-2">
              {stats?.unassignedPotsPools.map((p: any) => (
                <Link 
                  key={p.id} 
                  to={`/pools/${p.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 border border-transparent hover:border-muted transition-all"
                >
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100">Month {p.currentMonth}</span>
                </Link>
              ))}
              {stats?.unassignedPotsPools.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">All pots assigned for this month.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-emerald-600">
              <Calendar className="h-5 w-5" /> Upcoming Completions
            </h2>
            <div className="grid gap-2">
              {stats?.upcomingCompletions.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 border border-emerald-100/50">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs font-semibold text-emerald-800">{p.currentMonth} / {p.totalMonths} months</span>
                </div>
              ))}
              {stats?.upcomingCompletions.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No pools near completion.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
