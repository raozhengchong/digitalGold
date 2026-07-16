import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework';
import { indexProductsWorkflow } from '../../../../workflows/index-products';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const result = await indexProductsWorkflow(req.scope).run();

  res.json(result);
}
