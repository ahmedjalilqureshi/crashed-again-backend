const mongoose = require("mongoose");

const domainSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  status: { type: String, required: false },
  ping: { type: Number, required: false },
  responseRate: { type: String, required: false },
  snapshot: { type: String, required: false },
  lastUpdate: { type: Date, required: true },
  createdAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Domain", domainSchema);
