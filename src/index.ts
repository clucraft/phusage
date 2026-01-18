import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import usageRoutes from './routes/usage.js';
import ratesRoutes from './routes/rates.js';
import exportRoutes from './routes/export.js';
import adminRoutes from './routes/admin.js';
import estimatorRoutes from './routes/estimator.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', authenticateToken, uploadRoutes);
app.use('/api/usage', authenticateToken, usageRoutes);
app.use('/api/rates', authenticateToken, ratesRoutes);
app.use('/api/export', authenticateToken, exportRoutes);
app.use('/api/admin', authenticateToken, requireAdmin, adminRoutes);
app.use('/api/estimator', authenticateToken, estimatorRoutes);

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
