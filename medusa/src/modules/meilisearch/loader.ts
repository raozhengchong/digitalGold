import { LoaderOptions } from '@medusajs/types';
import { MeiliSearchService } from './service';
import { MeiliSearchPluginOptions } from './types';
import { asValue } from 'awilix';

export default async ({
  container,
  options,
}: LoaderOptions<MeiliSearchPluginOptions>): Promise<void> => {
  if (!options) {
    throw new Error('Missing meilisearch configuration');
  }

  const meilisearchService: MeiliSearchService = new MeiliSearchService(
    container,
    options,
  );

  container.register({
    meilisearchService: asValue(meilisearchService),
  });

  if (options.settings) {
    await Promise.all(
      Object.entries(options.settings).map(([indexName, indexSettings]) =>
        meilisearchService.updateSettings(indexName, indexSettings),
      ),
    );
  }
};
