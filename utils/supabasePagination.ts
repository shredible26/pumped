const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_FILTER_CHUNK_SIZE = 100;

interface PaginatedRowsResult<Row> {
  data: Row[] | null;
  error: unknown;
}

export async function fetchAllPaginatedRows<Row>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<PaginatedRowsResult<Row>>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<Row[]> {
  const rows: Row[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

export async function fetchAllPaginatedRowsForValues<Row, Value extends string | number>(
  values: Value[],
  fetchPage: (
    chunk: Value[],
    from: number,
    to: number,
  ) => PromiseLike<PaginatedRowsResult<Row>>,
  options?: {
    chunkSize?: number;
    pageSize?: number;
  },
): Promise<Row[]> {
  const uniqueValues = [...new Set(values)];
  if (uniqueValues.length === 0) return [];

  const chunkSize = options?.chunkSize ?? DEFAULT_FILTER_CHUNK_SIZE;
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const rows: Row[] = [];

  for (let chunkStart = 0; chunkStart < uniqueValues.length; chunkStart += chunkSize) {
    const chunk = uniqueValues.slice(chunkStart, chunkStart + chunkSize);
    const chunkRows = await fetchAllPaginatedRows<Row>(
      (from, to) => fetchPage(chunk, from, to),
      pageSize,
    );
    rows.push(...chunkRows);
  }

  return rows;
}
