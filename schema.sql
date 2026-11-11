CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  provider_id text,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  folder text NOT NULL CHECK (folder IN ('inbox','sent','trash')),
  sender text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  -- HTML is not rendered in this MVP to avoid unsafe email markup.
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mailbox_id, direction, provider_id)
);
CREATE INDEX IF NOT EXISTS messages_box_folder_time_idx ON messages(mailbox_id,folder,created_at DESC);
