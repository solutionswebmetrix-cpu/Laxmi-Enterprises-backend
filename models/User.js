const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'teacher'],
    default: 'teacher'
  },
  schoolId: {
    type: String,
    required: true
  },
  schoolName: {
    type: String,
    trim: true,
    default: 'Your College Name'
  },
  schoolTagline: {
    type: String,
    trim: true,
    default: 'Excellence in Education'
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
