// Google Picker integration for selecting Drive folders under the drive.file scope.
// The Picker grants per-folder/file access automatically — no broad scopes needed.

let pickerLoaderPromise: Promise<void> | null = null;

/**
 * Loads the Google API script and the picker module exactly once.
 */
export function loadGooglePicker(): Promise<void> {
  if (pickerLoaderPromise) return pickerLoaderPromise;

  pickerLoaderPromise = new Promise((resolve, reject) => {
    // Already loaded?
    // @ts-ignore - google global
    if (typeof window !== "undefined" && (window as any).google?.picker) {
      resolve();
      return;
    }

    const existing = document.getElementById("google-api-script") as HTMLScriptElement | null;

    const onScriptLoad = () => {
      // @ts-ignore - gapi global
      const gapi = (window as any).gapi;
      if (!gapi) {
        reject(new Error("Google API script loaded but gapi is undefined"));
        return;
      }
      gapi.load("picker", {
        callback: () => resolve(),
        onerror: () => reject(new Error("Failed to load Google Picker module")),
      });
    };

    if (existing) {
      existing.addEventListener("load", onScriptLoad, { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google API script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-api-script";
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = onScriptLoad;
    script.onerror = () => reject(new Error("Failed to load Google API script"));
    document.body.appendChild(script);
  });

  return pickerLoaderPromise;
}

export interface PickedFolder {
  id: string;
  name: string;
}

interface OpenFolderPickerOptions {
  accessToken: string;
  apiKey?: string | null;
  appId?: string | null;
  onPicked: (folder: PickedFolder) => void;
  onCancel?: () => void;
}

/**
 * Opens the Google Picker configured to select a single folder.
 * Returns when the picker is shown; the result is delivered via onPicked / onCancel.
 */
export async function openFolderPicker(opts: OpenFolderPickerOptions): Promise<void> {
  await loadGooglePicker();

  // @ts-ignore - google global
  const google = (window as any).google;
  if (!google?.picker) {
    throw new Error("Google Picker is not available");
  }

  const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setSelectFolderEnabled(true)
    .setIncludeFolders(true)
    .setMimeTypes("application/vnd.google-apps.folder");

  const builder = new google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(opts.accessToken)
    .setTitle("Select a folder containing your invoice PDFs");

  if (opts.apiKey) builder.setDeveloperKey(opts.apiKey);
    .setCallback((data: any) => {
      const action = data[google.picker.Response.ACTION];
      if (action === google.picker.Action.PICKED) {
        const doc = data[google.picker.Response.DOCUMENTS]?.[0];
        if (doc) {
          opts.onPicked({
            id: doc[google.picker.Document.ID],
            name: doc[google.picker.Document.NAME] || "Selected folder",
          });
        }
      } else if (action === google.picker.Action.CANCEL) {
        opts.onCancel?.();
      }
    });

  if (opts.appId) builder.setAppId(opts.appId);

  builder.build().setVisible(true);
}
