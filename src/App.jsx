// notesapp/src/App.jsx
import { useEffect, useState } from "react";
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

import awsExports from "./aws-exports"; // created in CI
Amplify.configure(awsExports);

// Data client (expects a model named `Note`)
const client = generateClient({ authMode: "userPool" });

export default function App() {
  const [notes, setNotes] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [creating, setCreating] = useState(false);

  // Live query notes and resolve signed image URLs
  useEffect(() => {
    const sub = client.models.Note.observeQuery().subscribe({
      next: async ({ items }) => {
        const withUrls = await Promise.all(
          items.map(async (n) => {
            if (!n.imageKey) return n;
            try {
              const { url } = await getUrl({ key: n.imageKey });
              return { ...n, imageUrl: url.toString() };
            } catch {
              return n;
            }
          })
        );
        // newest first if createdAt exists
        withUrls.sort((a, b) =>
          (b.createdAt || "").localeCompare(a.createdAt || "")
        );
        setNotes(withUrls);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  async function createNote(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      let imageKey;

      if (file instanceof File && file.size > 0) {
        // Match your Storage rule: "media/{entity_id}/*"
        const { result } = await uploadData({
          data: file,
          path: ({ identityId }) => `media/${identityId}/${Date.now()}_${file.name}`,
          options: { contentType: file.type || "application/octet-stream" },
        });
        imageKey = result.key;
      }

      await client.models.Note.create({
        name: name.trim(),
        description: description.trim(),
        imageKey,
      });

      setName("");
      setDescription("");
      setFile(null);
    } finally {
      setCreating(false);
    }
  }

  async function deleteNote(id, imageKey) {
    await client.models.Note.delete({ id });
    if (imageKey) {
      try {
        await removeFromStorage({ key: imageKey });
      } catch {
        /* ignore storage delete failures */
      }
    }
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
                gap: 16,
                marginTop: 12,
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
                    <p style={{ margin: "0 0 8px", color: "#555" }}>
                      {n.description}
                    </p>
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
