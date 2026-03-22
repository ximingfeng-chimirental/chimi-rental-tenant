import { model, models, Schema } from "mongoose";

const PropertySchema = new Schema(
  {
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    zipCode: String,
  },
  { timestamps: true }
);

const Property = models.Property || model("Property", PropertySchema);

export default Property;
