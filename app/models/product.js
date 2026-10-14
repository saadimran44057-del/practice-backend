import { DataTypes, FLOAT } from "sequelize";
import { sequelize } from '../config/connection.js';
const Product = sequelize.define(
  "Product",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,

      validate: {
        notNull: { msg: "Name is required" },
        notEmpty: { msg: "Cannot be empty" },
        len: { args: [3, 100], msg: "Name must be 3 to 100 character" },
      },
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        notNull: { msg: "Price is required" },
        isFloat: { msg: "Price must be Number" },
        min: { args: [1], msg: "Price must be Greater then 0" },
      },
    },
    Description: {
      type: DataTypes.TEXT,
      validate: {
        len: { args: [0, 500], msg: "Description max 500 characters" },
      },
    },
  },
  {
    tableName: "Product",
    timestamps: "True",
  }
);

export default Product;
