const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://instructorali123:<password>@cluster0.xus1zye.mongodb.net/crm-system?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('Connected!'))
  .catch(err => console.error('Connection error:', err));
