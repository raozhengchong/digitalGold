import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { CustomerDTO } from "@medusajs/framework/types";

export default async function sendPasswordResetNotification({
  event: { data },
  container,
}: SubscriberArgs<{ entity_id: string; token: string; actor_type: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notificationModuleService = container.resolve(Modules.NOTIFICATION);

  const fields = [
    "id",
    "email",
    "first_name",
    "last_name",
  ] as const satisfies (keyof CustomerDTO)[];

  const { data: customers } = await query.graph({
    entity: "customer",
    fields,
    filters: { email: data.entity_id },
  });
  const customer = customers[0] as Pick<CustomerDTO, (typeof fields)[number]>;

  await notificationModuleService.createNotifications({
    to: customer.email,
    channel: "email",
    template:
      data.actor_type === "logged-in-customer"
        ? "auth-password-reset"
        : "auth-forgot-password",
    data: { customer, token: data.token },
  });
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
};
