import type { SuperDocDocument } from "@superdoc/sdk";
import type { BrowserDocumentApi } from "superdoc/ui";
/** Normalize the published SDK's transport envelope and mutation-option placement.
 * The document operations, guards and readback logic remain shared with the browser.
 */
export function sdkDocument(handle: SuperDocDocument): BrowserDocumentApi {
  function wrap(value: object, path = ""): object {
    return new Proxy(value, {
      get(target, prop) {
        const member = Reflect.get(target, prop);
        if (typeof member === "function")
          return async (
            input: Record<string, unknown> = {},
            options: Record<string, unknown> = {},
          ) => {
            const args = { ...input, ...options };
            if (path === "comments" && "commentId" in args) {
              args.id = args.commentId;
              delete args.commentId;
            }
            const result = await member.call(target, args);
            return result && typeof result === "object" && "receipt" in result
              ? result.receipt
              : result;
          };
        if (member && typeof member === "object")
          return wrap(member, String(prop));
        return member;
      },
    });
  }
  const api = wrap(handle);
  return new Proxy(api, {
    get(target, prop) {
      if (prop === "capabilities") return () => handle.capabilities.get();
      return Reflect.get(target, prop);
    },
  }) as BrowserDocumentApi;
}
