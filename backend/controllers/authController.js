const User = require('../models/User');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../frontend/public/upload_dp/');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('profilePicture');

exports.register = async (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    try {
      const { username, email, password } = req.body;
      
      // Check for existing email only
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already registered. Please use a different email.' });
      }

      const profilePicture = req.file ? `/upload_dp/${req.file.filename}` : '';
      const user = new User({ username, email, password, profilePicture });
      await user.save();
      res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
      // Handle MongoDB duplicate key errors (only for email)
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        if (field === 'email') {
          return res.status(400).json({ message: 'Email already registered. Please use a different email.' });
        }
      }
      // Handle validation errors
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(error => error.message);
        return res.status(400).json({ message: messages.join(', ') });
      }
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, profilePicture: user.profilePicture } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}; 