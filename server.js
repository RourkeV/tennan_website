
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());


// Simple GET endpoint to read all audit_log records 
app.get('/api/audit-log/all', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM audit_log ORDER BY timestamp DESC');
    res.json({
      success: true,
      message: rows.length ? 'Audit log records retrieved successfully.' : 'No audit log records found.',
      audits: rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log records.',
      error: err.message
    });
  }
});
// Get latest audit log records (limit 25)
app.get('/api/audit/recent', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const limit = parseInt(req.query.limit) || 25;
  try {
    const [rows] = await pool.query(
        `SELECT a.timestamp, u.name AS user, a.action, a.table_name, a.field_name, a.old_value, a.new_value
        FROM audit_log a
        LEFT JOIN users u ON a.user_id = u.user_id
        ORDER BY a.timestamp DESC
        LIMIT ?`,
      [limit]
    );
    res.json({
      success: true,
      message: rows.length ? `Latest ${rows.length} audit records retrieved.` : 'No audit records found.',
      audits: rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent audit records.',
      error: err.message
    });
  }
});

console.log('🔄 Starting server...');
console.log('📝 Database configuration:');
console.log('   Host:', process.env.DB_HOST);
console.log('   User:', process.env.DB_USER);
console.log('   Database:', process.env.DB_NAME);
console.log('   Port:', process.env.DB_PORT);

// Create connection pool WITHOUT database (to create database first)
const poolWithoutDB = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Create connection pool WITH database (for normal operations)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Step 1: Create database if it doesn't exist
async function ensureDatabaseExists() {
    try {
        console.log('🔄 Checking if database exists...');
        const connection = await poolWithoutDB.getConnection();
        
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        console.log(`✅ Database '${process.env.DB_NAME}' is ready`);
        
        connection.release();
    } catch (err) {
        console.error('❌ Failed to create database:', err.message);
        throw err;
    }
}

// Step 2: Create tables
async function initializeDatabase() {
    try {
        console.log('🔄 Connecting to database...');
        const connection = await pool.getConnection();
        console.log('✅ Connected to AWS RDS MySQL');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                user_id INT,
                action VARCHAR(50),
                table_name VARCHAR(50),
                record_id INT,
                field_name VARCHAR(50),
                old_value TEXT,
                new_value TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Create users table
        await connection.query(`
          CREATE TABLE IF NOT EXISTS users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            phone VARCHAR(20),
            password_hash VARCHAR(255) NOT NULL,
            order_amount INT DEFAULT 0,
            role VARCHAR(20) DEFAULT 'client',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Add role column if missing (for migrations)
        const [cols] = await connection.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
        `, [process.env.DB_NAME]);
        if (!cols.length) {
          await connection.query(`ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'client'`);
          console.log('✅ Migrated users table: added role column');
        }
        console.log('✅ Users table ready');

        // Create orders table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS orders (
                order_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                subtotal DECIMAL(10, 2),
                tax DECIMAL(10, 2),
                total DECIMAL(10, 2),
                status VARCHAR(20) DEFAULT 'pending',
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                INDEX idx_user_id (user_id)
            )
        `);
        console.log('✅ Orders table ready');

        // Create milkshakes table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS milkshakes (
                milkshake_id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT,
                flavor VARCHAR(50),
                size VARCHAR(20),
                thickness VARCHAR(20),
                topping VARCHAR(50),
                price DECIMAL(10, 2),
                FOREIGN KEY (order_id) REFERENCES orders(order_id),
                INDEX idx_order_id (order_id)
            )
        `);
        console.log('✅ Milkshakes table ready');


        //milkshake details
        await connection.query(`
            CREATE TABLE IF NOT EXISTS toppings (
                topping_id INT AUTO_INCREMENT PRIMARY KEY,
                topping_name varchar(50) UNIQUE,
                createdModified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Toppings table ready');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS thickness (
                thickness_id INT AUTO_INCREMENT PRIMARY KEY,
                thickness_name varchar(50) UNIQUE,
                createdModified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Thickness table ready');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS flavour (
                flavour_id INT AUTO_INCREMENT PRIMARY KEY,
                flavour_name varchar(50) UNIQUE,
                createdModified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Flavour table ready');

        // Create fees table for configurable fees
        await connection.query(`
          CREATE TABLE IF NOT EXISTS fees (
            fee_id INT AUTO_INCREMENT PRIMARY KEY,
            fee_type VARCHAR(50) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        // Insert default fee if not exists
        const [feeRows] = await connection.query('SELECT * FROM fees WHERE fee_type = "order"');
        if (feeRows.length === 0) {
          await connection.query('INSERT INTO fees (fee_type, amount) VALUES ("order", 10.00)');
        }
        console.log('✅ Fees table ready');

        // Schema migration: rename legacy column if it exists
        await migrateFlavourColumnIfNeeded(connection);

        connection.release();

        console.log('✅ Database initialization complete\n');
    } catch (err) {
        console.error('❌ Database initialization failed:');
        console.error('   Error:', err.message);
        console.error('   Code:', err.code);
    }
}

// Check and migrate flavour column name
async function migrateFlavourColumnIfNeeded(conn) {
    const [cols] = await conn.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'flavour'
    `, [process.env.DB_NAME]);

    const hasThicknessName = cols.some(c => c.COLUMN_NAME === 'thickness_name');
    const hasFlavourName = cols.some(c => c.COLUMN_NAME === 'flavour_name');

    if (hasThicknessName && !hasFlavourName) {
        console.log('🔧 Migrating flavour.thickness_name -> flavour.flavour_name...');
        await conn.query(`
            ALTER TABLE flavour
            CHANGE COLUMN thickness_name flavour_name VARCHAR(50) UNIQUE
        `);
        console.log('✅ Migration complete');
    }
}

// Initialize in correct order
async function startDatabase() {
    await ensureDatabaseExists();
    await initializeDatabase();
}

startDatabase();

// API Routes

// Check email availability
app.get('/api/users/check-email', async (req, res) => {
    const { email } = req.query;
      if (!email) return res.status(400).json({
        available: false,
        message: 'Email is required.',
        error: 'Missing email parameter.'
      });
    try {
        const [rows] = await pool.query('SELECT 1 FROM users WHERE email = ? LIMIT 1', [email]);
          res.json({
            available: rows.length === 0,
            message: rows.length === 0 ? 'Email is available.' : 'Email is already registered.'
          });
    } catch (err) {
          res.status(500).json({
            available: false,
            message: 'Failed to check email availability.',
            error: err.message
          });
    }
});

// Register new user (returns 409 if email exists)
app.post('/api/register', async (req, res) => {
    const { name, email, phone, password, role } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required.',
          error: 'Missing required registration fields.'
        });
      }
    const userRole = role && ['manager', 'client'].includes(role) ? role : 'client';
    try {
      const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [email]);
      if (existing.length) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered.',
          error: 'Duplicate email.'
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [name, email, phone || null, passwordHash, userRole],
      );
      await pool.query(
        'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [result.insertId, 'INSERT', 'users', result.insertId, null, null, JSON.stringify({name, email, phone, role: userRole})]
      );

      res.status(201).json({
        success: true,
        message: 'Registration successful.',
        user: { userId: result.insertId, name, email, role: userRole }
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Email already registered.',
          error: 'Duplicate email.'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Registration failed.',
        error: err.message
      });
    }
});

// Payment endpoint
app.post('/api/orders/:orderId/pay', authenticateUser, async (req, res) => {
  const { orderId } = req.params;
  const userId = req.authenticatedUserId;
  // Simulate payment details
  const { cardNumber, cardName } = req.body;
  // Validate payment details first
  if (!cardNumber || !cardName) {
    return res.status(400).json({
      success: false,
      message: 'Card details required.',
      error: 'Missing card information.'
    });
  }
  try {
    // Check order exists and belongs to user
    const [orders] = await pool.query('SELECT * FROM orders WHERE order_id = ? AND user_id = ?', [orderId, userId]);
    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
        error: 'No matching order for user.'
      });
    }
    // Only update database after payment validation and order existence
    // Mark as paid
    await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', ['paid', orderId]);
    // Generate fake transaction ID
    const transactionId = 'MOCK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    // Log payment in audit log
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'PAYMENT', 'orders', orderId, 'status', orders[0].status, 'paid']
    );
    // Send confirmation via Formspree
    try {
      const userEmail = orders[0].email || req.user?.email;
      await axios.post('https://formspree.io/f/{form_id}', {
        Email: userEmail,
        message: `Dear ${orders[0].name},\nYour payment for order #${orderId} was successful.\nOrder Details:\n- Order ID: ${orderId}\n- Amount: ${orders[0].order_amount}\nThank you for your purchase!\nMilkyShake Team`
      });
    } catch (mailErr) {
      console.error('Formspree send error:', mailErr);
    }
    res.json({
      success: true,
      message: 'Payment successful. Order marked as paid.',
      transactionId,
      orderId
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Payment failed.',
      error: err.message
    });
  }
});

// Login user
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required.',
          error: 'Missing login fields.'
        });
      }

    try {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password.',
            error: 'Authentication failed.'
          });
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password.',
            error: 'Authentication failed.'
          });
        }

        res.json({
          success: true,
          message: 'Login successful.',
          user: {
          userId: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role
          }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
          success: false,
          message: 'Login failed.',
          error: err.message
        });
    }
});

// Simple authentication middleware
function authenticateUser(req, res, next) {
    const userId = req.headers['x-user-id']; // Get user ID from header
    
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Please login to place an order.',
          error: 'Authentication required.'
        });
      }
    
    req.authenticatedUserId = parseInt(userId);
    next();
}

    // Role-based authorization middleware
    function authorizeRole(requiredRole) {
      return async function (req, res, next) {
        const userId = req.authenticatedUserId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'User not authenticated.',
            error: 'Authentication required.'
          });
        }
        try {
          const [rows] = await pool.query('SELECT role FROM users WHERE user_id = ? LIMIT 1', [userId]);
          if (!rows.length) {
            return res.status(403).json({
              success: false,
              message: 'User not found.',
              error: 'Authorization failed.'
            });
          }
          const userRole = rows[0].role;
          if (userRole !== requiredRole) {
            return res.status(403).json({
              success: false,
              message: `Access denied: ${requiredRole} role required.`,
              error: 'Insufficient permissions.'
            });
          }
          next();
        } catch (err) {
          res.status(500).json({ success: false, error: err.message });
        }
      };
    }

// Create order with milkshakes - NOW USES AUTHENTICATED USER
app.post('/api/orders', authenticateUser, async (req, res) => {
    const { subtotal, tax, total, milkshakes } = req.body;
    const userId = req.authenticatedUserId; // Get from auth middleware

      if (!milkshakes || milkshakes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one milkshake is required.',
          error: 'No milkshakes provided.'
        });
      }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Insert order for the authenticated user
        const [orderResult] = await connection.query(
            'INSERT INTO orders (user_id, subtotal, tax, total, status) VALUES (?, ?, ?, ?, ?)',
            [userId, subtotal, tax, total, 'pending']
        );
        const orderId = orderResult.insertId;

        await connection.query(
            'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'INSERT', 'orders', orderId, null, null, JSON.stringify({subtotal, tax, total, status: 'pending'})]
        );

        // Insert milkshakes
        for (const shake of milkshakes) {
            await connection.query(
                'INSERT INTO milkshakes (order_id, flavor, size, thickness, topping, price) VALUES (?, ?, ?, ?, ?, ?)',
                [orderId, shake.flavor, shake.size, shake.thickness, shake.topping, shake.price]
            );
        }

        await connection.query(
            'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'INSERT', 'orders', orderId, null, null, JSON.stringify({subtotal, tax, total, status: 'pending'})]
        );

        // Increment the logged-in user's order_amount
        const milkshakeCount = milkshakes.length;
        await connection.query(
            'UPDATE users SET order_amount = order_amount + ? WHERE user_id = ?',
            [milkshakeCount, userId]
        );

        // Fetch updated order_amount and user name
        const [userRows] = await connection.query(
            'SELECT order_amount, name FROM users WHERE user_id = ?',
            [userId]
        );
        const updatedOrderAmount = userRows.length ? userRows[0].order_amount : null;
        const userName = userRows.length ? userRows[0].name : null;

        await connection.commit();

        res.json({
          success: true,
          message: `Order placed successfully! Total milkshakes ordered: ${updatedOrderAmount}`,
          orderId,
          milkshakeCount,
          updatedOrderAmount
        });
    } catch (err) {
        await connection.rollback();
        console.error('Order creation error:', err);
        res.status(500).json({
          success: false,
          message: 'Order creation failed.',
          error: err.message
        });
    } finally {
        connection.release();
    }
});

// Optional endpoint: Recalculate a user's order_amount from existing orders/milkshakes
app.post('/api/users/:userId/recalc-order-amount', async (req, res) => {
    try {
        const userId = req.params.userId;
        // Count all milkshakes across all orders for this user
        const [rows] = await pool.query(
              `SELECT COALESCE(COUNT(m.milkshake_id), 0) AS total
              FROM orders o
              LEFT JOIN milkshakes m ON o.order_id = m.order_id
              WHERE o.user_id = ?`,
            [userId]
        );
        const total = rows[0].total;

        await pool.query(
            'UPDATE users SET order_amount = ? WHERE user_id = ?',
            [total, userId]
        );

        res.json({
          success: true,
          message: 'Order amount recalculated successfully.',
          userId,
          recalculatedOrderAmount: total
        });
    } catch (err) {
        res.status(500).json({
          success: false,
          message: 'Failed to recalculate order amount.',
          error: err.message
        });
    }
});

// Get user's orders
app.get('/api/users/:userId/orders', async (req, res) => {
    try {
        const [orders] = await pool.query(
              `SELECT o.*, m.flavor, m.size, m.thickness, m.topping, m.price as milkshake_price
              FROM orders o
              LEFT JOIN milkshakes m ON o.order_id = m.order_id
              WHERE o.user_id = ?
              ORDER BY o.order_date DESC`,
            [req.params.userId]
        );

        res.json({
          success: true,
          message: orders.length ? 'Orders retrieved successfully.' : 'No orders found for this user.',
          orders: orders
        });
    } catch (err) {
        console.error('Fetch orders error:', err);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve user orders.',
          error: err.message
        });
    }
});

// Get all users (for testing)
app.get('/api/users', async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT user_id, name, email, phone, order_amount, created_at FROM users'
        );
        res.json({
          success: true,
          message: users.length ? 'Users retrieved successfully.' : 'No users found.',
          users: users
        });
    } catch (err) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve users.',
          error: err.message
        });
    }
});

// Get a single user (for client discount/order amount lookup)
app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (Number.isNaN(userId)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid user id.',
            error: 'User id must be a number.'
          });
        }
        const [rows] = await pool.query(
            'SELECT user_id, name, email, phone, order_amount, created_at FROM users WHERE user_id = ? LIMIT 1',
            [userId]
        );
        if (!rows.length) {
          return res.status(404).json({
            success: false,
            message: 'User not found.',
            error: 'No user with that id.'
          });
        }
        res.json({
          success: true,
          message: 'User retrieved successfully.',
          user: rows[0]
        });
    } catch (err) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve user.',
          error: err.message
        });
    }
});

// Serve static files so you can open http://localhost:3000/pages/lookup.html
app.use(express.static(path.join(__dirname)));

// Category lookup endpoints (use category tables; fallback to milkshakes DISTINCT)
app.get('/api/flavours', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT flavour_id, flavour_name, createdModified_at FROM flavour ORDER BY flavour_name'
    );
    res.json({ flavours: rows });
  } catch (err) {
    console.error('GET /api/flavours failed:', err);
    res.status(500).json({ error: err.message });
  }
});
// Update flavour name
app.put('/api/flavours/:id', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  if (!name) return res.status(400).json({ success: false, error: 'Name required' });
  try {
    const [rows] = await pool.query('SELECT flavour_name FROM flavour WHERE flavour_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Flavour not found' });
    const oldValue = rows[0].flavour_name;
    await pool.query('UPDATE flavour SET flavour_name = ? WHERE flavour_id = ?', [name, id]);
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'UPDATE', 'flavour', id, 'flavour_name', oldValue, name]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update topping name
app.put('/api/toppings/:id', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  if (!name) return res.status(400).json({ success: false, error: 'Name required' });
  try {
    const [rows] = await pool.query('SELECT topping_name FROM toppings WHERE topping_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Topping not found' });
    const oldValue = rows[0].topping_name;
    await pool.query('UPDATE toppings SET topping_name = ? WHERE topping_id = ?', [name, id]);
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'UPDATE', 'toppings', id, 'topping_name', oldValue, name]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update thickness name
app.put('/api/thicknesses/:id', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  if (!name) return res.status(400).json({ success: false, error: 'Name required' });
  try {
    const [rows] = await pool.query('SELECT thickness_name FROM thickness WHERE thickness_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Thickness not found' });
    const oldValue = rows[0].thickness_name;
    await pool.query('UPDATE thickness SET thickness_name = ? WHERE thickness_id = ?', [name, id]);
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'UPDATE', 'thickness', id, 'thickness_name', oldValue, name]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/toppings', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT topping_id, topping_name, createdModified_at FROM toppings ORDER BY topping_name'
    );
    res.json({ toppings: rows });
  } catch (err) {
    console.error('GET /api/toppings failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/thicknesses', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT thickness_id, thickness_name, createdModified_at FROM thickness ORDER BY thickness_name'
    );
    res.json({ thicknesses: rows });
  } catch (err) {
    console.error('GET /api/thicknesses failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/flavours', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { name } = req.body;
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const [result] = await pool.query('INSERT INTO flavour (flavour_name) VALUES (?)', [name]);
    const flavourId = result.insertId;
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'INSERT', 'flavour', flavourId, 'flavour_name', null, name]
    );
    res.json({ success: true });
    
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Flavour already exists' });
    } else {
      console.error('POST /api/flavours error:', err);
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/api/toppings', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { name } = req.body;
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const [result] = await pool.query('INSERT INTO toppings (topping_name) VALUES (?)', [name]);
    const toppingId = result.insertId;
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'INSERT', 'toppings', toppingId, 'topping_name', null, name]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/thicknesses', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { name } = req.body;
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const [result] = await pool.query('INSERT INTO thickness (thickness_name) VALUES (?)', [name]);
    const thicknessId = result.insertId;
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'INSERT', 'thickness', thicknessId, 'thickness_name', null, name]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/flavours/:id', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  try {
    const [rows] = await pool.query('SELECT flavour_name FROM flavour WHERE flavour_id = ?', [id]);
    const oldValue = rows.length ? rows[0].flavour_name : null;
    await pool.query('DELETE FROM flavour WHERE flavour_id = ?', [id]);
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'DELETE', 'flavour', id, 'flavour_name', oldValue, null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/toppings/:id', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  try {
    const [rows] = await pool.query('SELECT topping_name FROM toppings WHERE topping_id = ?', [id]);
    const oldValue = rows.length ? rows[0].topping_name : null;
    await pool.query('DELETE FROM toppings WHERE topping_id = ?', [id]);
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'DELETE', 'toppings', id, 'topping_name', oldValue, null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/thicknesses/:id', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  try {
    const [rows] = await pool.query('SELECT thickness_name FROM thickness WHERE thickness_id = ?', [id]);
    const oldValue = rows.length ? rows[0].thickness_name : null;
    await pool.query('DELETE FROM thickness WHERE thickness_id = ?', [id]);
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'DELETE', 'thickness', id, 'thickness_name', oldValue, null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get audit log
app.get('/api/audit-log', authenticateUser, authorizeRole('manager'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM audit_log ORDER BY timestamp DESC');
    res.json({ auditLog: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all orders with user info
app.get('/api/orders', async (req, res) => {
  try {
    const [orders] = await pool.query(
        `SELECT o.order_id, o.order_date, o.total, o.subtotal, o.tax, o.status, u.name, u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.user_id
        ORDER BY o.order_date DESC`
    );
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all milkshakes with order and user info
app.get('/api/milkshakes', async (req, res) => {
  try {
    const [milkshakes] = await pool.query(
        `SELECT m.milkshake_id, m.order_id, m.flavor, m.size, m.thickness, m.topping, m.price, o.order_date, u.name AS user_name, u.email AS user_email
        FROM milkshakes m
        LEFT JOIN orders o ON m.order_id = o.order_id
        LEFT JOIN users u ON o.user_id = u.user_id
        ORDER BY m.milkshake_id DESC`
    );
    res.json({ success: true, milkshakes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get last 20 orders with all milkshake details for each order
app.get('/api/reports/recent-orders', authenticateUser, authorizeRole('manager'), async (req, res) => {
  try {
    // Get last 20 orders with user info
    const [orders] = await pool.query(
        `SELECT o.order_id, o.order_date, o.total, u.name, u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.user_id
        ORDER BY o.order_date DESC
        LIMIT 20`
    );

    // For each order, get milkshakes
    const orderIds = orders.map(o => o.order_id);
    let milkshakesByOrder = {};
    if (orderIds.length) {
      const [milkshakes] = await pool.query(
        `SELECT order_id, flavor, size, thickness, topping, price FROM milkshakes WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
        orderIds
      );
      milkshakes.forEach(m => {
        if (!milkshakesByOrder[m.order_id]) milkshakesByOrder[m.order_id] = [];
        milkshakesByOrder[m.order_id].push(m);
      });
    }

    // Attach milkshakes to each order
    const detailedOrders = orders.map(o => ({
      order_id: o.order_id,
      order_date: o.order_date,
      total: o.total,
      user: {
        name: o.name,
        email: o.email
      },
      milkshakes: milkshakesByOrder[o.order_id] || []
    }));

    res.json({ success: true, orders: detailedOrders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/reports/orders-per-week', authenticateUser, authorizeRole('manager'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT YEAR(order_date) AS year, WEEK(order_date, 1) AS week, COUNT(*) AS count
      FROM orders
      GROUP BY year, week
      ORDER BY year DESC, week DESC
      LIMIT 12
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/reports/orders-per-month', authenticateUser, authorizeRole('manager'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT YEAR(order_date) AS year, MONTH(order_date) AS month, COUNT(*) AS count
      FROM orders
      GROUP BY year, month
      ORDER BY year DESC, month DESC
      LIMIT 12
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/reports/top-categories', authenticateUser, authorizeRole('manager'), async (req, res) => {
  try {
    // Top flavours
    const [topFlavours] = await pool.query(`
      SELECT flavor AS name, COUNT(*) AS count
      FROM milkshakes
      GROUP BY flavor
      ORDER BY count DESC
      LIMIT 5
    `);
    // Top toppings
    const [topToppings] = await pool.query(`
      SELECT topping AS name, COUNT(*) AS count
      FROM milkshakes
      GROUP BY topping
      ORDER BY count DESC
      LIMIT 5
    `);
    // Top thickness
    const [topThickness] = await pool.query(`
      SELECT thickness AS name, COUNT(*) AS count
      FROM milkshakes
      GROUP BY thickness
      ORDER BY count DESC
      LIMIT 5
    `);
    res.json({ success: true, topFlavours, topToppings, topThickness });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

  // Summary report: total orders and total revenue
  app.get('/api/reports/summary', authenticateUser, authorizeRole('manager'), async (req, res) => {
    try {
      // Get total orders
      const [ordersResult] = await pool.query('SELECT COUNT(*) AS totalOrders FROM orders');
      // Get total revenue
      const [revenueResult] = await pool.query('SELECT SUM(total) AS totalRevenue FROM orders');
      // Get orders today
      const [ordersTodayResult] = await pool.query('SELECT COUNT(*) AS ordersToday FROM orders WHERE DATE(order_date) = CURDATE()');
      // Get top flavour
      const [topFlavourResult] = await pool.query(`SELECT flavor AS name, COUNT(*) AS count FROM milkshakes GROUP BY flavor ORDER BY count DESC LIMIT 1`);
      // Get top topping
      const [topToppingResult] = await pool.query(`SELECT topping AS name, COUNT(*) AS count FROM milkshakes GROUP BY topping ORDER BY count DESC LIMIT 1`);
      // Get top thickness
      const [topThicknessResult] = await pool.query(`SELECT thickness AS name, COUNT(*) AS count FROM milkshakes GROUP BY thickness ORDER BY count DESC LIMIT 1`);
      res.json({
        success: true,
        totalOrders: ordersResult[0].totalOrders || 0,
        totalRevenue: revenueResult[0].totalRevenue || 0,
        ordersToday: ordersTodayResult[0].ordersToday || 0,
        topFlavour: topFlavourResult[0]?.name || null,
        topTopping: topToppingResult[0]?.name || null,
        topThickness: topThicknessResult[0]?.name || null
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

// Update order fee (manager only)
app.post('/api/fees/update', authenticateUser, authorizeRole('manager'), async (req, res) => {
  const { amount } = req.body;
  if (typeof amount !== 'number' || amount < 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid fee amount.'
    });
  }
  try {
    await pool.query('UPDATE fees SET amount = ? WHERE fee_type = "order"', [amount]);
    res.json({
      success: true,
      message: `Order fee updated to ${amount}`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update fee.',
      error: err.message
    });
  }
});

// Error handling
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

// Ensure server is listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`))
    .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use`);
        } else {
            console.error('❌ Server error:', err);
        }
    });

