const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  father: {
    type: String,
    required: true,
    trim: true
  },
  mother: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: 'Male'
  },
  rollNo: {
    type: String,
    trim: true
  },
  section: {
    type: String,
    trim: true
  },
  className: {
    type: String,
    required: true,
    trim: true
  },
  dob: {
    type: Date,
    required: true
  },
  blood: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  photo: {
    type: String, // URL or base64
    required: true
  },
  schoolName: {
    type: String,
    trim: true
  },
  cardStatus: {
    type: String,
    enum: ['Pending', 'Generated', 'Printed'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Student', studentSchema);