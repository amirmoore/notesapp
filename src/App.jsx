// src/App.jsx
import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import {
  uploadData,
  getUrl,
  remove as removeFromStorage,
} from "aws-amplify/storage";
import {
  Authenticator,
  Button,
  Divider,
  Flex,
  Grid,
  Heading,
  Text,
  TextField,
  View,
} from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import outputs from "../amplify_outputs.json";

/**
 * Configure Amplify with generated outputs
 */
Amplify.configure(outputs);

/**
 * Data client (expects a model named `Note`)
 * If your model is named `Notes`, change `client.models.Note` -> `client.models.Notes`
 */
const client = generateClient({ authMode: "userPool" });

export default function App() {
  const [notes, setNotes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * fetchNotes - subscribe to Note items and resolve image URLs (if any)
   */
  useEffect(() => {
    const sub = client.models.Note.observeQuery().subscribe({
      next: async ({ items }) => {
        // Resolve image URLs (signed) for any notes that have imageKey
        const itemsWithUrls = await Promise.all(
          items.map(async (n) => {
            if (!n.imageKey) return n;
            try {
              const url = await getUrl({
                key: n.imageKey,
              });
              return { ...n, imageUrl: url.url.toString() };
            } catch {
              return n; // if it fails, just return the note without an image url
            }
          })
        );
        setNotes(itemsWithUrls);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  /**
   * createNote - read form fields; if an image is provided, upload to Storage
   * under path: media/{entity_id}/<filename> to match your storage access rule.
   */
  async function createNote(event) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const form = new FormData(event.target);
      const name = String(form.get("name") || "").trim();
      const content = String(form.get("content") || "").trim();
      const file = form.get("image");

      let imageKey = undefined;

      if (file && file instanceof File && file.size > 0) {
        // Store user file under the identity-aware prefix required by your rule
        // "media/{entity_id}/*"
        const result = await uploadData({
          data: file,
          path: ({ identityId }) => `media/${identityId}/${file.name}`,
        }).result;
        imageKey = result.key;
      }

      await client.models.Note.create({ name, content, imageKey });
      event.target.reset();
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * deleteNote - remove the note; optionally remove its image from Storage
   */
  async function deleteNote(note) {
    // delete the record
    await client.models.Note.delete({ id: note.id });

    // best effort delete of the stored image (if present)
    if (note.imageKey) {
      try {
        await removeFromStorage({ key: note.imageKey });
      } catch {
        // ignore storage delete errors (record is already gone)
      }
    }
  }

  return (
    <Authenticator>
      {({ signOut }) => (
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="flex-start"
          gap="1.5rem"
          width="min(1100px, 92vw)"
          margin="0 auto"
          padding="2rem 0"
        >
          <Heading level={1}>Notes</Heading>

          {/* createNote form */}
          <View as="form" onSubmit={createNote} style={{ width: "100%" }}>
            <Flex
              direction={{ base: "column", large: "row" }}
              gap="1rem"
              alignItems="stretch"
            >
              <TextField
                name="name"
                label="Title"
                placeholder="Note title"
                labelHidden
                variation="quiet"
                required
                style={{ flex: 1 }}
              />
              <TextField
                name="content"
                label="Content"
                placeholder="Write something…"
                labelHidden
                variation="quiet"
                required
                style={{ flex: 2 }}
              />
              <input
                name="image"
                type="file"
                accept="image/*"
                style={{ alignSelf: "center" }}
              />
              <Button type="submit" variation="primary" isLoading={isSubmitting}>
                Create Note
              </Button>
            </Flex>
          </View>

          <Divider />

          <Heading level={2} style={{ alignSelf: "flex-start" }}>
            Your Notes
          </Heading>

          {/* fetchNotes display */}
          <Grid
            as="section"
            autoFlow="row"
            templateColumns={{ base: "1fr", medium: "1fr 1fr", large: "1fr 1fr 1fr" }}
            gap="1.25rem"
            width="100%"
          >
            {notes.map((note) => (
              <Flex
                key={note.id}
                direction="column"
                gap="0.75rem"
                padding="1rem"
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: 12,
                  background: "white",
                }}
              >
                <Heading level={3} style={{ margin: 0 }}>
                  {note.name}
                </Heading>
                <Text>{note.content}</Text>

                {note.imageUrl && (
                  <img
                    src={note.imageUrl}
                    alt={note.name}
                    style={{
                      width: "100%",
                      height: 180,
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />
                )}

                <Button
                  variation="destructive"
                  onClick={() => deleteNote(note)}
                >
                  Delete Note
                </Button>
              </Flex>
            ))}
          </Grid>

          <Button onClick={signOut}>Sign Out</Button>
        </Flex>
      )}
    </Authenticator>
  );
}
