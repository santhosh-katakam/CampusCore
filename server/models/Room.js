const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
  roomId: String,
  name: String,
  type: String, // Classroom / Lab
  capacity: Number,
  sessionYear: String
});

const getRoomModel = (connection) => {
  return connection.models.Room || connection.model('Room', RoomSchema);
};

module.exports = { RoomSchema, getRoomModel };
