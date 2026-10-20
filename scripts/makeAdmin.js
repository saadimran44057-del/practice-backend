import 'dotenv/config';
import { sequelize } from '../app/config/connection.js';
const email = process.argv[2];

const [, result] = await sequelize.query(
  `UPDATE "Users" SET role = 'admin' WHERE email = :email`,
  { replacements: { email } }
);
console.log(`Updated ${result.rowCount} user(s)`);
await sequelize.close();  