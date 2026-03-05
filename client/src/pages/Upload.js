import React, { useState, useRef } from "react";
import API from "../services/api";

const MB = 1024 * 1024;
const GB = 1024 * MB;

const getChunkSize = (fileSize) => {
  if (fileSize < 5 * MB) return fileSize; // Strategy 1: Single-shot for very small files
  if (fileSize < 1 * GB) return 5 * MB;   // Strategy 2: Sequential-friendly chunks
  if (fileSize < 10 * GB) return 10 * MB;
  return 20 * MB;
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

function Upload() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [shareLink, setShareLink] = useState("");

  // Metadata Settings
  const [password, setPassword] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
  const [maxDownloads, setMaxDownloads] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");

  const uploadIdRef = useRef(null);
  const currentChunkRef = useRef(0);
  const totalChunksRef = useRef(0);
  const isStoppingRef = useRef(false);
  const chunkSizeRef = useRef(5 * MB);

  const handleUpload = async (resume = false) => {
    if (!file && !resume) {
      alert("Please select a file");
      return;
    }

    try {
      setUploading(true);
      setPaused(false);
      setShareLink("");
      isStoppingRef.current = false;

      let uploadId = uploadIdRef.current;
      let startChunk = currentChunkRef.current;

      if (!resume) {
        setMessage("Initiating secure transfer...");
        const chunkSize = getChunkSize(file.size);
        chunkSizeRef.current = chunkSize;
        const totalChunks = Math.ceil(file.size / chunkSize);
        totalChunksRef.current = totalChunks;

        // Calculate expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));

        const initiateRes = await API.post("/uploads/initiate", {
          originalName: file.name,
          totalChunks: totalChunks,
          fileSize: file.size,
          expiryDate: expiryDate.toISOString(),
          password: password || null,
          maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
          receiverEmail: receiverEmail || null
        });

        uploadId = initiateRes.data.uploadId;
        uploadIdRef.current = uploadId;
        startChunk = 0;

        // Strategy 3: Persist session for large files
        if (file.size > 1 * GB) {
          localStorage.setItem("upload_session", JSON.stringify({
            uploadId,
            fileName: file.name,
            fileSize: file.size,
            chunkSize,
            totalChunks
          }));
        }
      }

      setMessage("Streaming encrypted chunks...");

      const PARALLEL_THRESHOLD = 1 * GB;
      if (file.size > PARALLEL_THRESHOLD) {
        await uploadParallel(uploadId, startChunk);
      } else {
        await uploadSequential(uploadId, startChunk);
      }

      if (isStoppingRef.current) return;

      // Finish chunks
      setMessage("Chunks uploaded. Finalizing and encrypting...");
      setProgress(99);

      // Polling for completion
      let isCompleted = false;
      let pollCount = 0;
      while (!isCompleted && pollCount < 60) {
        const statusRes = await API.get(`/uploads/${uploadId}/status`);
        if (statusRes.data.status === "completed") {
          isCompleted = true;
          if (statusRes.data.shareToken) {
            setShareLink(`${window.location.origin}/receive/${statusRes.data.shareToken}`);
          }
        } else if (statusRes.data.status === "failed") {
          throw new Error("Server finalization failed.");
        }

        if (!isCompleted) {
          await new Promise(r => setTimeout(r, 5000));
          pollCount++;
        }
      }

      if (!isCompleted) throw new Error("Processing timeout.");

      setMessage("Success! File is encrypted and ready to share.");
      setProgress(100);
      setUploading(false);
      localStorage.removeItem("upload_session");
      localStorage.removeItem("upload_chunk");

    } catch (error) {
      console.error("UPLOAD ERROR:", error);
      const errMsg = error.response?.data?.error || error.message || "Transfer interrupted.";
      setMessage(errMsg);
      setUploading(false);
      setPaused(!errMsg.includes("limit") && !errMsg.includes("failed"));
    }
  };

  const uploadSequential = async (uploadId, startChunk) => {
    for (let i = startChunk; i < totalChunksRef.current; i++) {
      if (isStoppingRef.current) {
        handlePause();
        return;
      }
      await uploadChunk(uploadId, i);
    }
  };

  const uploadParallel = async (uploadId, startChunk) => {
    const queue = [];
    for (let i = startChunk; i < totalChunksRef.current; i++) {
      queue.push(i);
    }

    const CONCURRENCY = 3;
    const workers = Array(CONCURRENCY).fill(null).map(async () => {
      while (queue.length > 0 && !isStoppingRef.current) {
        const chunkIndex = queue.shift();
        await uploadChunk(uploadId, chunkIndex);
      }
    });

    await Promise.all(workers);
    if (isStoppingRef.current) handlePause();
  };

  const uploadChunk = async (uploadId, index) => {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        const chunkSize = chunkSizeRef.current;
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunkBlob);
        formData.append("chunkIndex", index);

        await API.post(`/uploads/${uploadId}/chunk`, formData);

        // Update progress
        currentChunkRef.current = Math.max(currentChunkRef.current, index);
        localStorage.setItem("upload_chunk", index); // Strategy 3 persistence

        const completed = currentChunkRef.current + 1;
        const percent = Math.floor((completed / totalChunksRef.current) * 100);
        setProgress(old => Math.max(old, percent));
        return; // Success
      } catch (error) {
        attempt++;
        if (attempt >= MAX_RETRIES) throw error;
        setMessage(`Retry ${attempt}/${MAX_RETRIES} for chunk ${index}...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    }
  };

  const handlePause = () => {
    setPaused(true);
    setUploading(false);
    setMessage("Upload paused. You can resume later.");
  };

  const stopUpload = () => {
    isStoppingRef.current = true;
    setMessage("Stopping...");
  };

  // session recovery
  React.useEffect(() => {
    const session = localStorage.getItem("upload_session");
    if (session) {
      const parsed = JSON.parse(session);
      const chunk = parseInt(localStorage.getItem("upload_chunk") || "0");
      setMessage(`Found active session for ${parsed.fileName}. You can resume.`);
      uploadIdRef.current = parsed.uploadId;
      currentChunkRef.current = chunk;
      totalChunksRef.current = parsed.totalChunks;
      chunkSizeRef.current = parsed.chunkSize;
      // We don't automatically start, but we show the state
      setPaused(true);
      // We need to set the file too, but we can't from localStorage.
      // The user will have to select the same file again.
      setMessage(`Resume session for ${parsed.fileName}? Select the file again.`);
    }
  }, []);

  return (
    <div className="container animate-fade-in">
      <div className="card">
        <h2 className="mb-1">Secure Large File Transfer</h2>
        <p className="text-muted mb-2">AES-256-GCM Streaming Encryption</p>

        {!uploading && !paused && !shareLink && (
          <div className="settings-form animate-fade-in">
            <div className="mb-1">
              <label className="text-muted small">Select File</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="mb-1"
              />
            </div>

            <div className="upload-settings mb-2">
              <div>
                <label className="text-muted small">Protection Password</label>
                <input
                  type="password"
                  placeholder="Set password (optional)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="text-muted small">Expiry (Days)</label>
                <select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}>
                  <option value="1">1 Day</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                </select>
              </div>
              <div>
                <label className="text-muted small">Max Downloads</label>
                <input
                  type="number"
                  placeholder="Unlimited if empty"
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value)}
                />
              </div>
              <div>
                <label className="text-muted small">Receiver Email</label>
                <input
                  type="email"
                  placeholder="Notify receiver (optional)"
                  value={receiverEmail}
                  onChange={(e) => setReceiverEmail(e.target.value)}
                />
              </div>
            </div>

            <button onClick={() => handleUpload(false)} className="btn w-100">
              Start Secure Transfer
            </button>
          </div>
        )}

        {(uploading || paused) && (
          <div className="upload-progress-section animate-up">
            <div className="mb-1" style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="small font-bold">{file?.name}</span>
              <span className="small text-muted">{progress}%</span>
            </div>

            <div className="progress-bar mb-2">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              {uploading && (
                <button onClick={stopUpload} className="btn btn-outline w-100">
                  Stop Transfer
                </button>
              )}
              {paused && (
                <button onClick={() => handleUpload(true)} className="btn w-100">
                  Resume Transfer
                </button>
              )}
            </div>
          </div>
        )}

        {shareLink && (
          <div className="share-section animate-up mt-2">
            <div className="card" style={{ backgroundColor: "var(--bg-light)", border: "1px dashed var(--primary)" }}>
              <p className="small mb-1 font-bold">Your secure link is ready:</p>
              <input
                type="text"
                readOnly
                value={shareLink}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", fontSize: "0.8rem" }}
              />
              <button
                className="nav-button mt-1 w-100"
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  alert("Link copied!");
                }}
              >
                Copy Share Link
              </button>
            </div>
            <button onClick={() => { setShareLink(""); setFile(null); setProgress(0); setMessage(""); }} className="btn btn-outline w-100 mt-2">
              Upload Another File
            </button>
          </div>
        )}

        {message && (
          <p className="mt-2 text-center" style={{ color: "var(--primary-dark)", fontWeight: "600", fontSize: "0.875rem" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default Upload;
