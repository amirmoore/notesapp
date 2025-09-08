// src/App.jsx
import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl, remove as removeFromStorage } from "aws-amplify/storage";
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

import outputs from "C:\Users\amirs\awsTest\notesapp\amplify_outputs.json";

// Configure Amplify
Amplify.configure(outputs);

// Data client (expects a model named `Note`)
const client = generateClient({ authMode: "userPool" });

export default function App() {
  const [notes, setNotes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch & live-update notes; resolve signed image URLs if present
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
        setNotes(withUrls);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  // Create a note; optionally upload an image to Storage
  async function createNote(e) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const name = String(form.get("name") || "").trim();
      const content = String(form.get("content") || "").trim();
      const file = form.get("image");

      let imageKey;
      if (file instanceof File && file.size > 0) {
        const { result } = await uploadData({
          data: file,
          path: ({ identityId }) => `media/${identityId}/${file.name}`,
        });
        imageKey = result.key;
      }

      await client.models.Note.create({ name, content, imageKey });
      e.currentTarget.reset();
    } finally {
      setIsSubmitting(false);
    }
  }
}
