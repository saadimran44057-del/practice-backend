import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sequelize, connectDB } from './app/config/connection.js';
import './app/models/index.js';
import authRoutes from './app/routes/authRoutes.js';
import productRoutes from './app/routes/productRoutes.js';
import userRoutes from './app/routes/userRoutes.js';
import adminRoutes from './app/routes/adminRoutes.js';
import saleRoutes from './app/routes/saleRoutes.js';
import shopRoutes from './app/routes/shopRoutes.js';
import orderRoutes from './app/routes/orderRoutes.js';
import { seedRoles } from './app/utils/seedRoles.js';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/orders', orderRoutes);

app.use((err, req, res, next) => {
  res.status(400).json({ status: false, message: err.message });
});

const startServer = async () => {
  await connectDB();
  await sequelize.sync({ alter: true });
  await seedRoles();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer().catch((error) => {
  console.log('Server start failed:', error.message);
  process.exit(1);
});