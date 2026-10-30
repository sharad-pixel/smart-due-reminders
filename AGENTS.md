# Project conventions

- Use the shared invoice edit-lock helper to allow Recouply manual invoices to be edited independently of posting state while preserving posted contract locks; native edits must not bypass source-system warnings.

- Keep founder career copy in the shared founder configuration and render detailed engagements from that data on About; this avoids divergent role descriptions across the page.
- Reference downloaded company logos through Lovable Assets JSON pointers; this keeps media hosted and avoids third-party hotlinks.
- Inbound email processing accepts only a verified external webhook signature or the backend service credential; this supports trusted forwarding/replay without allowing user tokens or unsigned intake.
- Upload private documents under the authenticated uploader's folder; use signed preview URLs and authenticated downloads so storage policies stay enforced.
- Share invoice payment documents only through explicit invoice-document associations with same-account validation and the existing public-invoice token gate; never make the documents bucket public.