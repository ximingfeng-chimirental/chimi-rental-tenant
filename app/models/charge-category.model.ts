import { model, models, Schema } from "mongoose";

const ChargeCategorySchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    name: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const ChargeCategoryModel =
  models.chargecategories || model("chargecategories", ChargeCategorySchema);

export default ChargeCategoryModel;
