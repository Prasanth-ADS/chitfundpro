import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './db';
import authRoutes from './routes/auth';
import schemeRoutes from './routes/schemes';
import poolRoutes from './routes/pools';
import memberRoutes from './routes/members';
import enrollmentRoutes from './routes/enrollments';
import paymentRoutes from './routes/payments';
import potRoutes from './routes/pots';
import settingsRoutes from './routes/settings';
import notificationsRoutes from './routes/notifications';
import dashboardRoutes from './routes/dashboard';
import reportsRoutes from './routes/reports';
import whatsappRoutes from './routes/whatsapp';
import aiRoutes from './routes/ai';
import { initScheduler } from './services/scheduler';
import { initWhatsApp } from './services/whatsapp';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173', // Vite default port
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/pots', potRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ai', aiRoutes);

// Test DB Connection and Start Server
const PORT = process.env.PORT || 5000;

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Connected to database');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      initWhatsApp().catch(err => console.error('Failed to initialize WhatsApp:', err));
      initScheduler().catch(err => console.error('Failed to initialize scheduler:', err));
    });
  } catch (error) {
    console.error('Failed to connect to database', error);
    process.exit(1);
  }
}

startServer();
