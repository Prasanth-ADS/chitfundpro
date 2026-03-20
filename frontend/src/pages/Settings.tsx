import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Save, Bell, Smartphone, Send, Clock, CheckCircle, XCircle, Wifi, QrCode, LogOut } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

export function Settings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/api/settings');
      return res.data;
    }
  });

  const { data: logs } = useQuery({
    queryKey: ['notification-logs'],
    queryFn: async () => {
      const res = await api.get('/api/notifications/log');
      return res.data;
    },
    refetchInterval: 10000 // Poll every 10s for new logs
  });

  const { data: whatsappStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => {
      const res = await api.get('/api/whatsapp/status');
      return res.data;
    },
    refetchInterval: 3000 // Poll every 3s to get QR code instantly
  });

  const logoutWhatsAppMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/whatsapp/logout', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    }
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: any) => {
      const res = await api.put('/api/settings', updatedSettings);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Settings saved successfully!');
    },
    onError: () => {
      alert('Failed to save settings.');
    }
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/notifications/test', {});
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        alert('Test message sent successfully!');
      } else {
        alert('Failed to send test message. Check logs.');
      }
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to send test message');
    }
  });

  const sendNowMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/notifications/send-now', {});
      return res.data;
    },
    onSuccess: () => {
      alert('Reminders triggered. Check the log in a few seconds.');
    }
  });

  if (isLoading) return <div className="p-6">Loading settings...</div>;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    saveSettingsMutation.mutate({
      reminderDay: formData.get('reminderDay'),
      autoReminders: formData.get('autoReminders') === 'on',
      companyName: formData.get('companyName'),
      ownerPhone: formData.get('ownerPhone'),
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* WhatsApp Connection Status */}
        <div className="rounded-xl border bg-card p-6 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">WhatsApp Connection Status</h2>
            </div>
            <div>
              {whatsappStatus?.status === 'CONNECTED' && (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold">
                    <CheckCircle className="h-4 w-4" /> Connected
                  </span>
                  <Button variant="outline" size="sm" onClick={() => logoutWhatsAppMutation.mutate()} disabled={logoutWhatsAppMutation.isPending}>
                    <LogOut className="h-4 w-4 mr-2" /> Disconnect
                  </Button>
                </div>
              )}
              {whatsappStatus?.status === 'DISCONNECTED' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-semibold">
                  <XCircle className="h-4 w-4" /> Disconnected
                </span>
              )}
              {whatsappStatus?.status === 'CONNECTING' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold animate-pulse">
                  <QrCode className="h-4 w-4" /> Connecting...
                </span>
              )}
            </div>
          </div>
          
          {whatsappStatus?.status === 'CONNECTING' && whatsappStatus?.qr && (
            <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-muted/10 mt-4">
              <p className="text-sm text-muted-foreground mb-4 font-medium text-center">
                Scan this QR code with your WhatsApp app to link this device.<br/>
                Open WhatsApp &gt; Linked Devices &gt; Link a Device.
              </p>
              <div className="bg-white p-4 rounded-xl shadow-sm border">
                <QRCodeSVG value={whatsappStatus.qr} size={256} />
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp Notification Config */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">WhatsApp Auto-Reminders</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name (Signature)</Label>
              <Input id="companyName" name="companyName" defaultValue={settings?.companyName} required />
              <p className="text-xs text-muted-foreground">Appears at the bottom of the WhatsApp message.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reminderDay">Monthly Reminder Day (1-28)</Label>
              <Input id="reminderDay" name="reminderDay" type="number" min="1" max="28" defaultValue={settings?.reminderDay} required />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="autoReminders" className="text-base">Enable Auto Reminders</Label>
                <p className="text-sm text-muted-foreground">Send messages automatically on the scheduled day.</p>
              </div>
              <input 
                type="checkbox" 
                id="autoReminders" 
                name="autoReminders" 
                defaultChecked={settings?.autoReminders}
                className="h-5 w-5 accent-primary cursor-pointer" 
              />
            </div>

            <div className="grid gap-2 pt-2 border-t mt-2">
              <Label htmlFor="ownerPhone">Test Phone Number (With Country Code)</Label>
              <Input 
                id="ownerPhone" 
                name="ownerPhone" 
                placeholder="e.g. 919876543210" 
                defaultValue={settings?.ownerPhone} 
              />
              <p className="text-xs text-muted-foreground">Used for sending test messages only.</p>
            </div>

            <Button type="submit" className="mt-2" disabled={saveSettingsMutation.isPending}>
              <Save className="mr-2 h-4 w-4" /> Save Configuration
            </Button>
          </form>
        </div>

        {/* Manual Actions */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Manual Actions</h2>
            
            <div className="flex flex-col gap-4">
              <div className="border p-4 rounded-lg bg-emerald-50/50">
                <h3 className="font-semibold flex items-center gap-2 text-emerald-800 mb-2">
                  <Send className="h-4 w-4" /> Send Reminders Now
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Manually trigger the monthly payment reminders for all unpaid members right now, regardless of the scheduled day.
                </p>
                <Button 
                  onClick={() => {
                    if (confirm('Are you sure you want to send WhatsApp reminders to all unpaid members now?')) {
                      sendNowMutation.mutate();
                    }
                  }} 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={sendNowMutation.isPending}
                >
                  Trigger Reminders
                </Button>
              </div>

              <div className="border p-4 rounded-lg bg-blue-50/50">
                <h3 className="font-semibold flex items-center gap-2 text-blue-800 mb-2">
                  <Smartphone className="h-4 w-4" /> Send Test Message
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Send a test message to the configured test phone number to verify API credentials.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => sendTestMutation.mutate()} 
                  className="w-full text-blue-700 border-blue-200 hover:bg-blue-100"
                  disabled={sendTestMutation.isPending || !settings?.ownerPhone}
                >
                  Send Admin Test Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Log */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Recent Notification Log</h2>
        </div>

        <div className="relative w-full overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="py-3 px-4 font-medium">Date & Time</th>
                <th className="py-3 px-4 font-medium">Member Name</th>
                <th className="py-3 px-4 font-medium">Phone</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Message Snippet</th>
              </tr>
            </thead>
            <tbody>
              {!logs || logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No notifications sent yet.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {new Date(log.sentAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-medium">{log.memberName}</td>
                    <td className="py-3 px-4">{log.phone}</td>
                    <td className="py-3 px-4">
                      {log.status === 'SENT' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                          <CheckCircle className="h-3.5 w-3.5" /> Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold" title={log.errorMessage || 'Failed'}>
                          <XCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-muted-foreground" title={log.messageContent}>
                      {log.messageContent.split('\\n')[0]}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
