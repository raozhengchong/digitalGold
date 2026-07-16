import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework';
import emitCustomerWelcomeEvent from '../../../../../workflows/emit-customer-welcome-event';

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const customerId = req.auth_context.actor_id;

  await emitCustomerWelcomeEvent(req.scope).run({
    input: {
      id: customerId,
    },
  });

  res.status(200).json({ success: true });
};
