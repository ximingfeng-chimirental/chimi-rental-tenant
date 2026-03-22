import { model, models, Schema } from "mongoose";

const PropertyUnitSchema = new Schema(
  {
    name: String,
    property: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
  },
  { timestamps: true }
);

const PropertyUnit =
  models.PropertyUnit || model("PropertyUnit", PropertyUnitSchema);

export default PropertyUnit;
