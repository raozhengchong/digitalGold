import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework";
import Stripe from "stripe";

function getStripe() {
  const apiKey = process.env.STRIPE_API_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_API_KEY is not configured");
  }
  return new Stripe(apiKey);
}

export const GET = async (req: MedusaStoreRequest, res: MedusaResponse) => {
  const { id } = req.params;

  const paymentMethod = await getStripe().paymentMethods.retrieve(id);
  res.status(200).json(paymentMethod);
};
