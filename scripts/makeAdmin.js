import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config({ override: true });

console.log('Using SSL connection to:', process.env.DATABASE_URL?.split('@')[1]);

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
});

const email = process.argv[2];

const [, result] = await sequelize.query(
  `UPDATE "Users" SET role = 'admin' WHERE email = :email`,
  { replacements: { email } }
);
console.log(`Updated ${result.rowCount} user(s)`);
await sequelize.close();