import React, { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import awsExports from "./aws-exports";
import { generateClient } from "aws-amplify/api";
import { listTodos } from "./graphql/queries";
import {
  createTodo as createTodoMutation,
  deleteTodo as deleteTodoMutation,
} from "./graphql/mutations";

Amplify.configure(awsExports);

const App = () => {
  const [todos, setTodos] = useState([]);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const client = generateClient();

  async function fetchTodos() {
    const apiData = await client.graphql({ query: listTodos });
    setTodos(apiData.data.listTodos.items);
  }

  async function createTodo() {
    if (!formData.name || !formData.description) return;
    await client.graphql({
      query: createTodoMutation,
      variables: { input: formData },
    });
    setFormData({ name: "", description: "" });
    fetchTodos();
  }

  async function deleteTodo(id) {
    await client.graphql({
      query: deleteTodoMutation,
      variables: { input: { id } },
    });
    fetchTodos();
  }

  useEffect(() => {
    fetchTodos();
  }, []);

  // ... (inside the return statement of your component)
return (
  <Authenticator>
    {({ signOut, user }) => (
      <div style={{ padding: 20 }}>
        {/* ... */}
        <h3>My Todos</h3>
        <div style={{ width: 350, padding: '20px' }}>
          <input
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              padding: '0.75rem',
              width: '100%',
              marginBottom: '15px'
            }}
            placeholder="Note name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <input
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              padding: '0.75rem',
              width: '100%',
              marginBottom: '15px'
            }}
            placeholder="Note description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <button
            style={{
              backgroundColor: '#0e858a',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '1rem',
              width: '100%',
              cursor: 'pointer'
            }}
            onClick={createTodo}
          >
            Create Note
          </button>
        </div>
        {/* ... */}
      </div>
    )}
  </Authenticator>
);
/*
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div style={{ padding: 20 }}>
          <h2>Hello, {user?.username}</h2>
          <button onClick={signOut}>Sign Out</button>

          <h3>My Todos</h3>
          <input
            placeholder="Note name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <input
            placeholder="Note description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
          <button onClick={createTodo}>Create Note</button>

          <div style={{ marginTop: 20 }}>
            {todos.map((t) => (
              <div key={t.id} style={{ marginBottom: 10 }}>
                <strong>{t.name}</strong> – {t.description}
                <button
                  onClick={() => deleteTodo(t.id)}
                  style={{ marginLeft: 10 }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Authenticator>
  
  ); */
};

export default App;

