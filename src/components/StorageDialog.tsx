import { Database, HardDrive, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { requestPersistentStorage, storageStatus } from "../lib/persistence";

interface Status {
  persisted: boolean;
  usage: number;
  quota: number;
  opfs: boolean;
}
function bytes(value: number) {
  return value > 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : `${Math.round(value / 1000)} KB`;
}

export function StorageDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    void storageStatus().then(setStatus);
  }, []);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="storage-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="storage-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <Database size={17} />
            <span id="storage-title">Local storage</span>
          </div>
          <button aria-label="Close storage details" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="storage-hero">
          <HardDrive size={26} />
          <div>
            <strong>Your graphs stay in this browser</strong>
            <p>Ladder Graph has no account, backend, model connection, or telemetry. Export YAML for a durable backup.</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Persistence</dt>
            <dd>{status?.persisted ? "Requested and granted" : "Best effort"}</dd>
          </div>
          <div>
            <dt>Project database</dt>
            <dd>IndexedDB</dd>
          </div>
          <div>
            <dt>Revision storage</dt>
            <dd>{status?.opfs ? "OPFS with IndexedDB fallback" : "IndexedDB fallback"}</dd>
          </div>
          <div>
            <dt>Browser usage</dt>
            <dd>{status ? `${bytes(status.usage)} of ${bytes(status.quota)}` : "Checking…"}</dd>
          </div>
        </dl>
        <div className="storage-warning">
          <ShieldCheck size={16} />
          <span>Clearing site data can remove local projects. Download YAML before clearing browser storage.</span>
        </div>
        <button
          className="primary-button"
          onClick={async () => {
            await requestPersistentStorage();
            setStatus(await storageStatus());
          }}
        >
          Request persistent storage
        </button>
      </section>
    </div>
  );
}
