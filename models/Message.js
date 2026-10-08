const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 2000 }
}, { timestamps: true });

messageSchema.index({ ride: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
