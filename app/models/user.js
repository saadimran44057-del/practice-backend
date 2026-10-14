import { DataTypes } from "sequelize";
import { sequelize } from '../config/connection.js';
const User = sequelize.define('User',{
    id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true}, 

    name:{
        type:DataTypes.STRING,
        allowNull:false,
        unique:{msg:'Email already register'},
        validate:{
            notNull:{msg:'Name is required'},
            notEmpty:{msg:'Not can be empty'},
        }
    },

    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: { msg: 'Email already registered' },
        validate: {
          notNull: { msg: 'Email is required' },
          isEmail: { msg: 'Invalid email format' },
        }
    },

    password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    }, {
      tableName: 'users',
      timestamps: true,
    });
    
    export default User;
    
