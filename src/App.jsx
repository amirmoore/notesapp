// notesapp/src/App.jsx
import { useEffect, useRef, useState } from "react";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl, remove as removeFromStorage } from "aws-amplify/storage";
import {
  Authenticator,
  Button,
  Flex,
  Heading,
  TextField,
} from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

export default function App() {
  const [notes, setNotes] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [ready, setReady] = useState(false);

  // hold the client after config
  const clientRef = useRef(null);

  // 1) Load outputs at runtime, then configure Amplify and create the client
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/amplify_outputs.json", { cache: "no-store" });
        const outputs = await res.json();
        Amplify.configure(outputs);
        clientRef.current = generateClient({ authMode: "userPool" });
        setReady(true);
      } catch (e) {
        console.error("Failed to load amplify_outputs.json", e);
      }
    })();
  }, []);

  // 2) Fetch notes once the client is ready
  useEffect(() => {
    if (!ready || !clientRef.current) return;
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function fetchNotes() {
    const { data, errors } = await clientRef.current.models.Note.list();
    if (errors?.length) {
      console.error(errors);
      return;
    }
    const withUrls = await Promise.all(
      data.map(async (n) => {
        if (!n.imageKey) return n;
        try {
          const { url } = await getUrl({ key: n.imageKey });
          return { ...n, imageUrl: url.toString() };
        } catch {
          return n;
        }
      })
    );
    withUrls.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    setNotes(withUrls);
  }

  async function createNote(e) {
    e?.preventDefault?.();
    if (!name.trim() || !clientRef.current) return;

    setCreating(true);
    try {
      let imageKey;
      if (file) {
        // If your Storage rule requires identity-specific paths, use:
        // const { result } = await uploadData({
        //   data: file,
        //   path: ({ identityId }) => `media/${identityId}/${Date.now()}_${file.name}`,
        // });
        // imageKey = result.key;

        imageKey = `images/${Date.now()}_${file.name}`;
        await uploadData({
          key: imageKey,
          data: file,
          options: { contentType: file.type || "application/octet-stream" },
        }).result;
      }

      await clientRef.current.models.Note.create({
        name: name.trim(),
        description: description.trim(),
        imageKey,
      });

      setName("");
      setDescription("");
      setFile(null);
      await fetchNotes();
    } finally {
      setCreating(false);
    }
  }

  async function deleteNote(id, imageKey) {
    if (!clientRef.current) return;
    await clientRef.current.models.Note.delete({ id });
    if (imageKey) {
      try {
        await removeFromStorage({ key: imageKey });
      } catch (err) {
        console.warn("Storage remove failed (non-fatal):", err);
      }
    }
    await fetchNotes();
  }

  if (!ready) {
    return (
      <div style={{ maxWidth: 960, margin: "40px auto", padding: "24px" }}>
        <Heading level={3}>Loading…</Heading>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "24px" }}>
      <Heading level={2}>Notes</Heading>

      <Authenticator>
        {({ signOut, user }) => (
          <Flex direction="column" gap="1.25rem" marginTop="1rem">
            <div>
              Signed in as <strong>{user?.username}</strong>
            </div>

            <form onSubmit={createNote}>
              <Flex direction="column" gap="0.75rem">
                <TextField
                  label="Title"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Grocery list"
                  required
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details…"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <Button type="submit" isDisabled={creating}>
                  {creating ? "Creating…" : "Create note"}
                </Button>
              </Flex>
            </form>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "16px",
                marginTop: "12px",
              }}
            >
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <h3 style={{ margin: "0 0 4px" }}>{n.name}</h3>
                  {n.description && (
                    <p style={{ margin: "0 0 8px", color: "#555" }}>{n.description}</p>
                  )}
                  {n.imageUrl && (
                    <img
                      src={n.imageUrl}
                      alt={n.name}
                      style={{
                        width: "100%",
                        height: 160,
                        objectFit: "cover",
                        borderRadius: 8,
                        marginBottom: 8,
                      }}
                    />
                  )}
                  <Button
                    variation="destructive"
                    onClick={() => deleteNote(n.id, n.imageKey)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={signOut} variation="link">
              Sign out
            </Button>
          </Flex>
        )}
      </Authenticator>
    </div>
  );
}
