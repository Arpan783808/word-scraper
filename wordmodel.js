import mongoose from "mongoose";

const WordSchema = new mongoose.Schema({
  word: { type: String, required: true, unique: true },
  meaning: { type: String, required: true },
  pronounciation: { type: String, required: false },
  audiourl: { type: String, required: false, default: "null" },
  createdAt: { type: Date, default: Date.now },
});

export const Word = mongoose.models.Word || mongoose.model("Word", WordSchema);
