import { useEffect, useState } from 'react'
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'

import { Authenticator, Button, Flex, Heading, TextField } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'

import { generateClient } from 'aws-amplify/data'
import { uploadData, getUrl, remove as removeFromStorage } from 'aws-amplify/storage'

const client = generateClient()

Amplify.configure(outputs)

export default function App() {
  const [notes, setNotes] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [creating, setCreating] = useState(false)

  async function fetchNotes() {
    const { data, errors } = await client.models.Note.list()
    if (errors?.length) {
      console.error(errors)
      return
    }

    const withUrls = await Promise.all(
      data.map(async (n) => {
        if (n.imageKey) {
          try {
            const urlRes = await getUrl({ key: n.imageKey })
            return { ...n, imageUrl: urlRes?.url?.toString() }
          } catch {
            return n
          }
        }
        return n
      })
    )

    setNotes(withUrls.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')))
  }

  async function createNote(e) {
    e?.preventDefault?.()
    if (!name.trim()) return

    setCreating(true)
    try {
      let imageKey

      if (file) {
        imageKey = `images/${Date.now()}_${file.name}`
        await uploadData({
          key: imageKey,
          data: file,
          options: { contentType: file.type || 'application/octet-stream' },
        }).result
      }

      await client.models.Note.create({
        name: name.trim(),
        description: description.trim(),
        imageKey,
      })

      setName('')
      setDescription('')
      setFile(null)
      await fetchNotes()
    } finally {
      setCreating(false)
    }
  }

  async function deleteNote(id, imageKey) {
    await client.models.Note.delete({ id })
    if (imageKey) {
      try {
        await removeFromStorage({ key: imageKey })
      } catch (err) {
        console.warn('Storage remove failed (non-fatal):', err)
      }
    }
    await fetchNotes()
  }

  useEffect(() => {
    fetchNotes()
  }, [])

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', padding: '24px' }}>
      <Heading level={2}>Notes</Heading>

      <Authenticator>
        {({ signOut, user }) => (
          <Flex direction="column" gap="1.25rem" marginTop="1rem">
            <div>Signed in as <strong>{user?.username}</strong></div>

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
                  {creating ? 'Creating…' : 'Create note'}
                </Button>
              </Flex>
            </form>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '16px',
                marginTop: '12px',
              }}
            >
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <h3 style={{ margin: '0 0 4px' }}>{n.name}</h3>
                  {n.description && (
                    <p style={{ margin: '0 0 8px', color: '#555' }}>{n.description}</p>
                  )}
                  {n.imageUrl && (
                    <img
                      src={n.imageUrl}
                      alt={n.name}
                      style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
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
  )
}
