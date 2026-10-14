import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sequelize, connectDB } from './app/config/connection.js';
import './app/models/index.js';
import authRoutes from './app/routes/authRoutes.js';
import productRoutes from './app/routes/productRoutes.js';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

const startServer = async () => {
  await connectDB();
  await sequelize.sync({ alter: true });
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer().catch((error) => {
  console.log('Server start failed:', error.message);
  process.exit(1);
});