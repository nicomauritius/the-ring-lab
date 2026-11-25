/** What POST /api/designs/[id]/export returns: download links for one design version. */
export interface ExportResponse {
  version: number;
  stlUrl: string;
  specUrl: string;
}
