const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const quotationsRouter = require('./routes/quotations');
const serviceRouter = require('./routes/serviceRoutes');
const userRouter = require('./routes/userRoutes');
 
// Register routes
app.use('/api/quotations', quotationsRouter);
app.use('/api/services', serviceRouter);
app.use('/api/users', userRouter);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
}); 