const mongoose = require("mongoose");

const domainSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  status: { type: String, required: true },
  ping: { type: Number, required: true },
  responseRate: { type: String, required: true },
  snapshot: { type: String, required: true },
  lastUpdate: { type: Date, required: true },
  createdAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Domain", domainSchema);
