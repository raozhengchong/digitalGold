import { Module } from '@medusajs/utils';
import Loader from './loader';
import { MeiliSearchService } from './service';

export default Module('meilisearchService', {
  service: MeiliSearchService,
  loaders: [Loader],
});
