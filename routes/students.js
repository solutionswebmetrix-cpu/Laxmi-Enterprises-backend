const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cloudinary = require('cloudinary').v2;
const Student = require('../models/Student');
const User = require('../models/User');
const auth = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Test Cloudinary connection
cloudinary.api.ping()
  .then(res => console.log('Cloudinary connection successful:', res))
  .catch(err => console.error('Cloudinary configuration error:', err.message));

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

const getSchoolFilter = (user) => {
  // Admin (Owner) should see ALL students from ALL schools
  if (user.role === 'admin') {
    return {};
  }
  // Teachers only see students from their own school
  return { schoolId: user.schoolId };
};

// Check if user has permission for a specific student
const hasStudentPermission = (user, student) => {
  if (user.role === 'admin') return true;
  return student.schoolId.toString() === user.schoolId.toString();
};

// @route   GET /api/students
// @desc    Get all students (by school or all if admin)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const students = await Student.find(getSchoolFilter(req.user)).sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// @route   POST /api/students
// @desc    Add new student
// @access  Private
router.post('/', auth, async (req, res) => {
  let { name, father, mother, gender, className, section, rollNo, dob, blood, address, mobile, photo, schoolName } = req.body;

  try {
    console.log('Received student data for save:', { name, className, schoolId: req.user?.schoolId });

    // Fetch school info from the global admin
    if (!schoolName) {
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        schoolName = admin.schoolName;
      }
    }

    if (!name || !father || !className || !dob || !address || !mobile || !photo) {
      const missingFields = [];
      if (!name) missingFields.push('Name');
      if (!father) missingFields.push('Father Name');
      if (!className) missingFields.push('Class');
      if (!dob) missingFields.push('Date of Birth');
      if (!address) missingFields.push('Address');
      if (!mobile) missingFields.push('Mobile');
      if (!photo) missingFields.push('Student Photo');

      console.log('Missing required fields:', missingFields.join(', '));
      return res.status(400).json({ 
        message: `Missing fields: ${missingFields.join(', ')}`,
        error: 'Please fill all required fields'
      });
    }

    const newStudent = new Student({
      schoolId: req.user.schoolId,
      name,
      father,
      mother,
      gender,
      className,
      section,
      rollNo,
      dob,
      blood,
      address,
      mobile,
      photo,
      schoolName
    });

    const student = await newStudent.save();
    console.log('Student saved successfully:', student._id);
    res.json(student);
  } catch (err) {
    console.error('Error in POST /api/students:', err);
    res.status(500).json({ message: 'Server error while saving student', error: err.message });
  }
});

// @route   PUT /api/students/:id
// @desc    Update student
// @access  Private
router.put('/:id', auth, async (req, res) => {
  let { name, father, mother, gender, className, section, rollNo, dob, blood, address, mobile, photo, schoolName, cardStatus } = req.body;

  try {
    let student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (!hasStudentPermission(req.user, student)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Fetch school info from the global admin if not provided
    if (!schoolName) {
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        schoolName = admin.schoolName;
      }
    }

    student = await Student.findByIdAndUpdate(
      req.params.id,
      { name, father, mother, gender, className, section, rollNo, dob, blood, address, mobile, photo, schoolName, cardStatus },
      { new: true }
    );

    res.json(student);
  } catch (err) {
    console.error('Error in PUT /api/students:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/students/:id/status
// @desc    Update student card status
// @access  Private
router.patch('/:id/status', auth, async (req, res) => {
  const { cardStatus } = req.body;

  try {
    let student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (!hasStudentPermission(req.user, student)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    student.cardStatus = cardStatus;
    await student.save();

    res.json(student);
  } catch (err) {
    console.error('Error in PATCH /api/students/:id/status:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   DELETE /api/students/:id
// @desc    Delete student
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (!hasStudentPermission(req.user, student)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete photo from Cloudinary if it exists
    if (student.photo && student.photo.includes('cloudinary.com')) {
      try {
        const urlParts = student.photo.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const publicIdWithoutExt = fileName.split('.')[0];
        
        // Get the folder path from the URL
        const uploadIndex = urlParts.indexOf('upload');
        let publicId = publicIdWithoutExt;
        
        if (uploadIndex !== -1 && urlParts.length > uploadIndex + 2) {
          const pathParts = urlParts.slice(uploadIndex + 2, urlParts.length - 1);
          if (pathParts.length > 0) {
            publicId = [...pathParts, publicIdWithoutExt].join('/');
          }
        }
        
        console.log('Deleting Cloudinary photo with publicId:', publicId);
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudinaryErr) {
        console.error('Error deleting from Cloudinary:', cloudinaryErr);
      }
    }

    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/students/bulk-delete
// @desc    Delete multiple students
// @access  Private
router.post('/bulk-delete', auth, async (req, res) => {
  try {
    const { studentIds } = req.body;
    console.log('Bulk delete request for students:', studentIds);
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'No student IDs provided' });
    }

    // Get all students to be deleted to remove their photos from Cloudinary
    const students = await Student.find({ _id: { $in: studentIds } });
    
    // Check permissions for all students
    const unauthorized = students.some(s => !hasStudentPermission(req.user, s));
    if (unauthorized) {
      return res.status(403).json({ message: 'Not authorized to delete some students' });
    }

    // Delete photos from Cloudinary
    for (const student of students) {
      if (student.photo && student.photo.includes('cloudinary.com')) {
        try {
          const urlParts = student.photo.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const publicIdWithoutExt = fileName.split('.')[0];
          
          // Get the folder path from the URL
          // Format: .../upload/v1234567/folder/subfolder/publicId.ext
          const uploadIndex = urlParts.indexOf('upload');
          let publicId = publicIdWithoutExt;
          
          if (uploadIndex !== -1 && urlParts.length > uploadIndex + 2) {
            // Skip the 'upload' and 'version' (v1234567) parts
            const pathParts = urlParts.slice(uploadIndex + 2, urlParts.length - 1);
            if (pathParts.length > 0) {
              publicId = [...pathParts, publicIdWithoutExt].join('/');
            }
          }
          
          console.log('Deleting Cloudinary photo with publicId:', publicId);
          await cloudinary.uploader.destroy(publicId);
        } catch (cloudinaryErr) {
          console.error(`Error deleting Cloudinary photo for student ${student._id}:`, cloudinaryErr);
        }
      }
    }

    await Student.deleteMany({ _id: { $in: studentIds } });
    res.json({ message: `${students.length} students deleted successfully` });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: 'Server error during bulk delete' });
  }
});

// @route   POST /api/students/bulk-upload
// @desc    Bulk upload students from Excel
// @access  Private
router.post('/bulk-upload', [auth, upload.single('file')], async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Fetch school settings from the global admin
    const admin = await User.findOne({ role: 'admin' });
    
    const schoolName = admin?.schoolName || '';

    const students = data.map(row => ({
      schoolId: req.user.schoolId,
      name: row.Name || row.name,
      father: row.Father || row.father,
      mother: row.Mother || row.mother,
      gender: row.Gender || row.gender || 'Male',
      className: row.Class || row.className || row.class,
      section: row.Section || row.section || '',
      rollNo: row.RollNo || row.rollNo || '',
      dob: new Date(row.DOB || row.dob),
      blood: row.Blood || row.blood,
      address: row.Address || row.address,
      mobile: row.Mobile || row.mobile || row.Phone || row.phone,
      photo: row.Photo || row.photo || '',
      schoolName
    }));

    const insertedStudents = await Student.insertMany(students);
    res.json({ message: `${insertedStudents.length} students added successfully` });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/students/upload-photo
// @desc    Upload student photo to Cloudinary
// @access  Private
router.post('/upload-photo', [auth, upload.single('photo')], async (req, res) => {
  try {
    if (!req.file) {
      console.log('Upload attempt with no file');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log(`Uploading photo for schoolId: ${req.user?.schoolId}`);

    const stream = cloudinary.uploader.upload_stream({ 
      folder: `school-id-cards/${req.user?.schoolId || 'default'}` 
    }, (err, result) => {
      if (err) {
        console.error('Cloudinary upload stream error:', err);
        return res.status(500).json({ message: `Image upload failed: ${err.message || 'Unknown Cloudinary error'}` });
      }
      console.log('Cloudinary upload successful');
      res.json({ url: result.secure_url });
    });

    stream.end(req.file.buffer);
  } catch (err) {
    console.error('Upload photo route error:', err);
    res.status(500).json({ message: `Server error: ${err.message}` });
  }
});

// @route   GET /api/students/export
// @desc    Export students to Excel
// @access  Private
router.get('/export', auth, async (req, res) => {
  try {
    const students = await Student.find(getSchoolFilter(req.user)).sort({ createdAt: -1 });
    const worksheet = xlsx.utils.json_to_sheet(students.map((s) => ({
      Name: s.name,
      Father: s.father,
      Mother: s.mother,
      Gender: s.gender,
      Class: s.className,
      Section: s.section,
      RollNo: s.rollNo,
      DOB: s.dob ? s.dob.toISOString().split('T')[0] : '',
      Blood: s.blood,
      Address: s.address,
      Mobile: s.mobile,
      Photo: s.photo,
      CreatedAt: s.createdAt,
      UpdatedAt: s.updatedAt
    })));
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');

    const fileBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(fileBuffer);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;