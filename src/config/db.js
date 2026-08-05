const mongoose = require('mongoose');
const dns = require('dns');

// Use reliable Google/Cloudflare DNS servers to prevent querySrv ECONNREFUSED on local ISPs
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Ignore if setting DNS fails
}

const connectDB = async () => {
  const connectWithRetry = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      
      // Auto-seed default admin if no admin exists
      try {
        const User = require('../models/userModel');
        const adminExists = await User.findOne({ role: 'admin', isDeleted: false });
        if (!adminExists) {
          console.log('No admin user found. Auto-seeding default admin...');
          await User.create({
            name: process.env.ADMIN_NAME || 'Admin rks Solar Energy',
            email: process.env.ADMIN_EMAIL || 'rkssolarenergybiaora@gmail.com',
            phone: process.env.ADMIN_PHONE || '7773077772',
            password: process.env.ADMIN_PASSWORD || 'Admin@rkssolar123',
            role: 'admin',
            status: 'active'
          });
          console.log('Default admin user auto-seeded successfully!');
        }
      } catch (seedError) {
        console.error('Error during auto-seeding admin:', seedError.message);
      }
    } catch (error) {
      console.error(`MongoDB Connection Error: ${error.message}`);
      console.log('Retrying MongoDB connection in 10 seconds...');
      setTimeout(connectWithRetry, 10000);
    }
  };

  await connectWithRetry();
};

module.exports = connectDB;
