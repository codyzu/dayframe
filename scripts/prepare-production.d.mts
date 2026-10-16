import type {Unstable_Config} from 'wrangler';

export function createProductionConfig(
  base: Pick<
    Unstable_Config,
    | 'name'
    | 'main'
    | 'compatibility_date'
    | 'compatibility_flags'
    | 'workers_dev'
    | 'preview_urls'
    | 'vars'
    | 'observability'
    | 'assets'
    | 'durable_objects'
    | 'migrations'
  >,
  namespaceId: string | undefined,
): Pick<
  Unstable_Config,
  | 'name'
  | 'main'
  | 'compatibility_date'
  | 'compatibility_flags'
  | 'workers_dev'
  | 'preview_urls'
  | 'vars'
  | 'observability'
  | 'durable_objects'
  | 'migrations'
> & {
  assets: NonNullable<Unstable_Config['assets']>;
  kv_namespaces: Array<{binding: string; id: string}>;
};
