import { defineMiddlewares } from '@medusajs/medusa';
import { adminProductTypeRoutesMiddlewares } from './store/custom/product-types/middlewares';
import { authenticate } from '@medusajs/framework';

export default defineMiddlewares([
  ...adminProductTypeRoutesMiddlewares,
  {
    method: 'ALL',
    matcher: '/store/custom/customer/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
]);
