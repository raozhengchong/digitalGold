import {
  createWorkflow,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { emitEventStep } from '@medusajs/medusa/core-flows';

const emitCustomerWelcomeEvent = createWorkflow(
  'emit-customer-welcome-event',
  function (input: { id: string }) {
    emitEventStep({
      eventName: 'customer.welcome',
      data: {
        id: input.id,
      },
    });

    return new WorkflowResponse({ id: input.id });
  },
);

export default emitCustomerWelcomeEvent;
