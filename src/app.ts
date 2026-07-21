import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { propertiesRouter } from './modules/properties/properties.routes';
import { roomsRouter } from './modules/rooms/rooms.routes';
import { tenantsRouter } from './modules/tenants/tenants.routes';
import { contractsRouter } from './modules/contracts/contracts.routes';
import { billsRouter } from './modules/bills/bills.routes';
import { billPaymentsRouter, paymentsRouter } from './modules/payments/payments.routes';
import { complaintsRouter } from './modules/complaints/complaints.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { reportsRouter } from './modules/reports/reports.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(','),
    credentials: true,
  }),
);

// Rate limiter global
app.use(globalRateLimiter);

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/properties', propertiesRouter);

// Rooms di-nest di bawah properties
// Endpoint: /api/v1/properties/:propertyId/rooms
app.use('/api/v1/properties/:propertyId/rooms', roomsRouter);
app.use('/api/v1/tenants', tenantsRouter);
app.use('/api/v1/contracts', contractsRouter);
app.use('/api/v1/bills', billsRouter);
app.use('/api/v1/bills/:billId/payments', billPaymentsRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/complaints', complaintsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/reports', reportsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan',
    error: { code: 'NOT_FOUND' },
  });
});

// Error handler — harus paling bawah
app.use(errorHandler);

export default app;

if (require.main === module) {
  const PORT = parseInt(env.PORT, 10);
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}