import 'dotenv/config';
import { Sequelize } from 'sequelize';

// SSL only when DB_SSL=true (Neon, or Render's External URL from your laptop).
// Render's Internal URL (backend and database both on Render) doesn't need it.
const useSSL = process.env.DB_SSL === 'true';

export const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: useSSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    })
  : new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: 'postgres',
      logging: false,
    });

export const connectDB = async () => {
  await sequelize.authenticate();
  console.log('Database connected');
};