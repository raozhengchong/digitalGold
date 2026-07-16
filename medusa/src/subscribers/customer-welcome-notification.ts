import type { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { CustomerDTO } from '@medusajs/framework/types';

export default async function sendCustomerWelcomeNotification({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notificationModuleService = container.resolve(Modules.NOTIFICATION);

  const fields = [
    'id',
    'email',
    'first_name',
    'last_name',
  ] as const satisfies (keyof CustomerDTO)[];

  const { data: customers } = await query.graph({
    entity: 'customer',
    fields,
    filters: { id: data.id },
  });

  const customer = customers[0] as Pick<CustomerDTO, (typeof fields)[number]>;

  await notificationModuleService.createNotifications({
    to: customer.email,
    channel: 'email',
    template: 'customer-welcome',
    data: { customer },
  });
}

export const config: SubscriberConfig = {
  event: 'customer.welcome',
};
